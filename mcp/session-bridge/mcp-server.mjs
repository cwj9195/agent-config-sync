#!/usr/bin/env node
// session-bridge MCP: 跨工具会话读取 + 双向增量上下文同步
// 工具: list_sessions / read_session / current_session
// 零 npm 依赖；Kilo 适配器依赖系统 sqlite3 命令。
import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HOME = os.homedir();
const CLAUDE_PROJECTS = path.join(HOME, '.claude', 'projects');
const CODEX_SESSIONS = path.join(HOME, '.codex', 'sessions');
const KILO_DB = path.join(HOME, '.local', 'share', 'kilo', 'kilo.db');
const COPILOT_STORAGE_ROOTS = [
  process.env.SB_COPILOT_TRANSCRIPTS_DIR,
  path.join(
    HOME,
    'Library/Application Support/Code/User/workspaceStorage',
  ),
  path.join(
    HOME,
    'Library/Application Support/Code - Insiders/User/workspaceStorage',
  ),
  path.join(HOME, '.config/Code/User/workspaceStorage'),
  path.join(HOME, '.config/Code - Insiders/User/workspaceStorage'),
].filter(Boolean);

const STATE_DIR = process.env.SB_STATE_DIR
  || path.join(process.env.XDG_CACHE_HOME || path.join(HOME, '.cache'), 'session-bridge');
const WATERMARK = path.join(STATE_DIR, 'watermark.json');
const LEGACY_WATERMARK = path.join(HOME, '.codex', 'handoff', 'watermark.json');

const MAX_OUTPUT_CHARS = 60000;
const MAX_TOOL_RESULT_CHARS = 4000;
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18'];
let lastError = null;

const SB_DEBUG = process.env.SB_DEBUG === '1';
const SB_LOG = process.env.SB_DEBUG_LOG || '/tmp/sb.log';

function dbg(tag, s) {
  if (!SB_DEBUG) return;

  try {
    fs.appendFileSync(
      SB_LOG,
      `[${tag}] ${String(s).slice(0, 500)}\n`,
    );
  } catch {}
}

function setError(s) {
  lastError = String(s);
  dbg('ERROR', lastError);
}

const encodeProject = cwd => cwd.replace(/\//g, '-');
const escapeRegExp = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sqlString = s => `'${String(s).replace(/'/g, "''")}'`;

function safeLimit(value, fallback = 20, max = 500) {
  const n = Number(value);

  return Number.isFinite(n)
    ? Math.max(1, Math.min(max, Math.trunc(n)))
    : fallback;
}

function toEpoch(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'number') {
    return value < 1e11 ? value * 1000 : value;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(String(value).trim())) {
    return toEpoch(Number(value));
  }

  const n = Date.parse(String(value));
  return Number.isFinite(n) ? n : null;
}

function toIso(value) {
  const n = toEpoch(value);

  return n == null
    ? (value == null ? null : String(value))
    : new Date(n).toISOString();
}

function isAfter(value, since) {
  const a = toEpoch(value);
  const b = toEpoch(since);

  return a != null && b != null && a > b;
}

function sortByTimeDesc(a, b) {
  const at = toEpoch(a.ts);
  const bt = toEpoch(b.ts);

  if (at != null && bt != null) return bt - at;

  return String(b.ts || '').localeCompare(String(a.ts || ''));
}

function contentToText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map(c => (
        typeof c === 'string'
          ? c
          : c?.text || c?.output_text || ''
      ))
      .join('\n');
  }

  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

// ---------- Kilo DB 查询 ----------

function sqlite(args, timeout) {
  return execFileSync('sqlite3', args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function kiloQuery(sql) {
  if (!fs.existsSync(KILO_DB)) {
    return { error: 'KILO_DB not found' };
  }

  try {
    const out = sqlite(['-json', KILO_DB, sql], 10000);
    return out ? JSON.parse(out) : [];
  } catch (e) {
    const msg = String(e.stderr || e.message || e).trim();

    setError(
      `kiloQuery: ${msg} (sql=${sql.slice(0, 160)})`,
    );

    return { error: msg };
  }
}

function kiloScalar(sql) {
  if (!fs.existsSync(KILO_DB)) return null;

  try {
    return sqlite([KILO_DB, sql], 5000) || null;
  } catch (e) {
    setError(`kiloScalar: ${e.message}`);
    return null;
  }
}

const isRows = value => Array.isArray(value);

// ---------- JSONL 读取 ----------

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];

  const out = [];
  let text;

  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    setError(`readJsonl read fail @ ${file}: ${e.message}`);
    return out;
  }

  for (const [i, line] of text.split('\n').entries()) {
    if (!line.trim()) continue;

    try {
      out.push(JSON.parse(line));
    } catch (e) {
      setError(
        `readJsonl parse fail @ ${file}:${i + 1}: ${e.message}`,
      );
    }
  }

  return out;
}

function readJsonlUntil(file, maxLines, predicate) {
  if (!fs.existsSync(file)) return null;

  let fd;

  try {
    fd = fs.openSync(file, 'r');

    const buf = Buffer.alloc(65536);
    const decoder = new StringDecoder('utf8');

    let pending = '';
    let lineNo = 0;

    while (lineNo < maxLines) {
      const n = fs.readSync(
        fd,
        buf,
        0,
        buf.length,
        null,
      );

      if (n === 0) {
        pending += decoder.end();

        if (pending.trim()) {
          try {
            const hit = predicate(
              JSON.parse(pending),
              ++lineNo,
            );

            if (hit) return hit;
          } catch {}
        }

        break;
      }

      pending += decoder.write(buf.subarray(0, n));

      const parts = pending.split('\n');
      pending = parts.pop() || '';

      for (const line of parts) {
        if (!line.trim()) continue;

        lineNo++;

        try {
          const hit = predicate(
            JSON.parse(line),
            lineNo,
          );

          if (hit) return hit;
        } catch {}

        if (lineNo >= maxLines) break;
      }
    }

    return null;
  } catch (e) {
    setError(
      `readJsonlUntil @ ${file}: ${e.message}`,
    );

    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

// ---------- watermark ----------

let migrated = false;

function migrateLegacyWatermark() {
  if (migrated) return;

  migrated = true;

  try {
    if (
      !fs.existsSync(WATERMARK)
      && fs.existsSync(LEGACY_WATERMARK)
    ) {
      fs.mkdirSync(STATE_DIR, {
        recursive: true,
        mode: 0o700,
      });

      fs.copyFileSync(
        LEGACY_WATERMARK,
        WATERMARK,
      );

      dbg(
        'MIGRATE',
        `${LEGACY_WATERMARK} -> ${WATERMARK}`,
      );
    }
  } catch (e) {
    setError(
      `watermark 迁移失败: ${e.message}`,
    );
  }
}

function loadWM() {
  migrateLegacyWatermark();

  if (!fs.existsSync(WATERMARK)) return {};

  try {
    const wm = JSON.parse(
      fs.readFileSync(WATERMARK, 'utf8'),
    );

    return (
      wm
      && typeof wm === 'object'
      && !Array.isArray(wm)
    )
      ? wm
      : {};
  } catch (e) {
    setError(`loadWM fail: ${e.message}`);
    return {};
  }
}

function saveWM(wm) {
  try {
    fs.mkdirSync(STATE_DIR, {
      recursive: true,
      mode: 0o700,
    });

    const tmp = `${WATERMARK}.${process.pid}.tmp`;

    fs.writeFileSync(
      tmp,
      JSON.stringify(wm, null, 2),
      { mode: 0o600 },
    );

    fs.renameSync(tmp, WATERMARK);
  } catch (e) {
    setError(`saveWM fail: ${e.message}`);
  }
}

function normalizeWM(value) {
  if (!value) return null;

  if (
    typeof value === 'string'
    || typeof value === 'number'
  ) {
    return {
      msgSeq: null,
      fileSeq: null,
      msgTs: value,
      fileTs: value,
    };
  }

  const seq = v => (
    v != null && Number.isFinite(Number(v))
      ? Number(v)
      : null
  );

  return {
    msgSeq: seq(value.msgSeq),
    fileSeq: seq(value.fileSeq),
    msgTs: value.msgTs ?? value.lastTs ?? null,
    fileTs: value.fileTs ?? value.lastTs ?? null,
  };
}

// ---------- Codex 解析 ----------

function extractCodexReq(msg) {
  if (!msg) return '';

  const m = String(msg).split(
    /## My request for Codex:?/i,
  );

  return (m[1] || msg).trim();
}

function parseCodex(file) {
  const meta = {
    source: 'codex',
    cwd: null,
    git: null,
    sessionId: null,
    tsRange: [null, null],
  };

  const msgs = [];
  const files = [];
  const calls = new Map();

  for (const r of readJsonl(file)) {
    const ts = toIso(r.timestamp);

    if (ts) {
      if (!meta.tsRange[0]) {
        meta.tsRange[0] = ts;
      }

      meta.tsRange[1] = ts;
    }

    const t = r.type;
    const p = r.payload || {};

    if (t === 'session_meta') {
      meta.sessionId = p.id
        || p.session_id
        || path.basename(file)
          .match(/([0-9a-f-]{36})/)?.[1];

      meta.cwd = p.cwd || meta.cwd;
      meta.git = p.git || meta.git;

      continue;
    }

    if (t === 'turn_context') continue;

    if (t === 'event_msg') {
      if (p.type === 'user_message') {
        msgs.push({
          ts,
          role: 'user',
          text: extractCodexReq(p.message),
        });
      } else if (p.type === 'agent_message') {
        msgs.push({
          ts,
          role: 'assistant',
          text: p.message || '',
        });
      } else if (p.type === 'patch_apply_end') {
        for (
          const [fp, c]
          of Object.entries(p.changes || {})
        ) {
          files.push({
            ts,
            path: fp,
            type: c.type,
            diff: c.unified_diff || '',
          });
        }
      }

      continue;
    }

    if (t !== 'response_item') continue;

    if (p.type === 'message') {
      if (
        p.role === 'developer'
        || p.role === 'user'
      ) {
        continue;
      }

      if (
        p.role === 'assistant'
        && p.phase !== 'commentary'
      ) {
        const text = contentToText(p.content);

        if (text) {
          msgs.push({
            ts,
            role: 'assistant',
            text,
          });
        }
      }
    } else if (p.type === 'function_call') {
      let args = {};

      try {
        args = JSON.parse(p.arguments || '{}');
      } catch {
        args = {
          raw: p.arguments,
        };
      }

      calls.set(p.call_id, {
        name: p.name,
        args,
      });
    } else if (p.type === 'function_call_output') {
      const c = calls.get(p.call_id);

      if (c) {
        msgs.push({
          ts,
          role: 'tool',
          name: c.name,
          args: c.args,
          result: p.output,
          isError: false,
        });

        calls.delete(p.call_id);
      }
    }
  }

  return {
    meta,
    msgs,
    files,
  };
}

// ---------- Claude 解析 ----------

function renderEdit(inp) {
  const o = (inp.old_string || '')
    .split('\n')
    .map(l => '-' + l)
    .join('\n');

  const n = (inp.new_string || '')
    .split('\n')
    .map(l => '+' + l)
    .join('\n');

  return [
    `--- ${inp.file_path}`,
    `+++ ${inp.file_path}`,
    '@@ @@',
    o,
    n,
  ].join('\n');
}

function parseClaude(file) {
  const meta = {
    source: 'claude',
    cwd: null,
    git: null,
    sessionId: null,
    tsRange: [null, null],
  };

  const msgs = [];
  const files = [];
  const toolUses = new Map();

  for (const r of readJsonl(file)) {
    if (r.isSidechain) continue;

    const ts = toIso(r.timestamp);

    if (ts) {
      if (!meta.tsRange[0]) {
        meta.tsRange[0] = ts;
      }

      meta.tsRange[1] = ts;
    }

    if (!meta.sessionId && r.sessionId) {
      meta.sessionId = r.sessionId;
    }

    if (!meta.cwd && r.cwd) {
      meta.cwd = r.cwd;
    }

    if (!meta.git && r.gitBranch) {
      meta.git = {
        branch: r.gitBranch,
      };
    }

    if (
      r.type !== 'user'
      && r.type !== 'assistant'
    ) {
      continue;
    }

    const raw = r.message?.content;

    const content = typeof raw === 'string'
      ? [{ type: 'text', text: raw }]
      : Array.isArray(raw)
        ? raw
        : [];

    for (const c of content) {
      if (c.type === 'text') {
        msgs.push({
          ts,
          role: r.type,
          text: c.text || '',
        });
      } else if (c.type === 'tool_use') {
        toolUses.set(c.id, {
          name: c.name,
          input: c.input,
        });
      } else if (c.type === 'tool_result') {
        const tu = toolUses.get(c.tool_use_id);

        if (!tu) continue;

        msgs.push({
          ts,
          role: 'tool',
          name: tu.name,
          args: tu.input,
          result: contentToText(c.content),
          isError: !!c.is_error,
        });

        if (
          tu.name === 'Edit'
          && tu.input?.file_path
        ) {
          files.push({
            ts,
            path: tu.input.file_path,
            type: 'edit',
            diff: renderEdit(tu.input),
          });
        } else if (
          tu.name === 'Write'
          && tu.input?.file_path
        ) {
          files.push({
            ts,
            path: tu.input.file_path,
            type: 'write',
            content: tu.input.content,
          });
        }

        toolUses.delete(c.tool_use_id);
      }
    }
  }

  return {
    meta,
    msgs,
    files,
  };
}

function parseCopilot(file, fallbackId) {
  const meta = {
    source: 'copilot',
    cwd: null,
    git: null,
    sessionId: fallbackId || null,
    tsRange: [null, null],
  };

  const msgs = [];
  const files = [];
  const calls = new Map();

  for (const r of readJsonl(file)) {
    const ts = toIso(r.timestamp);

    if (ts) {
      if (!meta.tsRange[0]) {
        meta.tsRange[0] = ts;
      }

      meta.tsRange[1] = ts;
    }

    const data = r.data || {};

    if (r.type === 'session.start') {
      meta.sessionId = data.sessionId || meta.sessionId;
      continue;
    }

    if (r.type === 'user.message') {
      const text = contentToText(
        data.content ?? data.message,
      );

      if (text) {
        msgs.push({
          ts,
          role: 'user',
          text,
        });
      }

      continue;
    }

    if (r.type === 'assistant.message') {
      if (data.content) {
        msgs.push({
          ts,
          role: 'assistant',
          text: data.content,
        });
      }

      for (const request of data.toolRequests || []) {
        calls.set(request.toolCallId, {
          name: request.name,
          args: parseToolArguments(request.arguments),
        });
      }

      continue;
    }

    if (r.type === 'tool.execution_start') {
      calls.set(data.toolCallId, {
        name: data.toolName,
        args: data.arguments,
      });

      continue;
    }

    if (r.type !== 'tool.execution_complete') continue;

    const call = calls.get(data.toolCallId);
    const result = data.output
      ?? data.result
      ?? (
        data.success === undefined
          ? ''
          : JSON.stringify({ success: data.success })
      );

    msgs.push({
      ts,
      role: 'tool',
      name: call?.name || data.toolName || 'unknown',
      args: call?.args,
      result,
      isError: data.success === false,
    });

    calls.delete(data.toolCallId);
  }

  return {
    meta,
    msgs,
    files,
  };
}

function parseToolArguments(value) {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

// ---------- 文件定位 ----------

function findFile(dir, re) {
  if (!fs.existsSync(dir)) return null;

  let entries;

  try {
    entries = fs.readdirSync(dir, {
      withFileTypes: true,
    });
  } catch {
    return null;
  }

  for (const ent of entries) {
    if (ent.isSymbolicLink()) continue;

    const p = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      const r = findFile(p, re);

      if (r) return r;
    } else if (re.test(p)) {
      return p;
    }
  }

  return null;
}

function listFilesDeep(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;

  let entries;

  try {
    entries = fs.readdirSync(dir, {
      withFileTypes: true,
    });
  } catch {
    return out;
  }

  for (const ent of entries) {
    if (ent.isSymbolicLink()) continue;

    const p = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      listFilesDeep(p, ext, out);
    } else if (ent.name.endsWith(ext)) {
      out.push(p);
    }
  }

  return out;
}

function listCopilotTranscriptFiles() {
  const out = [];
  const seen = new Set();
  const transcriptPattern = new RegExp(
    `[\\\\/]GitHub\\.copilot-chat[\\\\/]transcripts[\\\\/][^\\\\/]+\\.jsonl$`,
  );

  for (const root of COPILOT_STORAGE_ROOTS) {
    const files = listFilesDeep(root, '.jsonl')
      .filter(file => (
        path.basename(root) === 'transcripts'
          || transcriptPattern.test(file)
      ));

    for (const file of files) {
      if (seen.has(file)) continue;

      seen.add(file);
      out.push(file);
    }
  }

  return out;
}

// ---------- 调用方识别 ----------

function codexMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  let value = meta['x-codex-turn-metadata']
    || meta.x_codex_turn_metadata
    || meta.codexTurnMetadata
    || meta['x-codex-session-metadata']
    || meta.x_codex_session_metadata
    || meta.codexSessionMetadata;

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value && typeof value === 'object'
    ? value
    : null;
}

/** 从 Codex 调用元数据中读取当前线程 ID。 */
function codexMetaThreadId(meta) {
  const cm = codexMeta(meta);
  const id = meta?.threadId
    || meta?.thread_id
    || cm?.thread_id
    || cm?.threadId;

  return typeof id === 'string' && id.trim()
    ? id.trim()
    : null;
}

/** 从 MCP 调用元数据读取 Kilo 当前会话 ID。 */
function kiloMetaSessionId(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  let value = meta['x-kilo-session-id']
    || meta.x_kilo_session_id
    || meta.kiloSessionId;

  if (typeof value === 'string') {
    const id = value.trim();

    if (id) return id;

    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  const id = value?.session_id
    || value?.sessionId
    || value?.id;

  return typeof id === 'string' && id.trim()
    ? id.trim()
    : null;
}

/** 从 VS Code MCP 元数据读取 Copilot 当前会话 ID。 */
function copilotMetaSessionId(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const id = meta['vscode.conversationId']
    || meta.vscodeConversationId;

  return typeof id === 'string' && id.trim()
    ? id.trim()
    : null;
}

/** 识别由调用端精确提供的会话身份。 */
function exactCaller(meta) {
  const codexId = codexMetaThreadId(meta);

  if (codexId) {
    return {
      source: 'codex',
      id: String(codexId),
      note: 'from Codex metadata',
    };
  }

  const copilotId = copilotMetaSessionId(meta);

  if (copilotId) {
    return {
      source: 'copilot',
      id: copilotId,
      note: 'from vscode.conversationId metadata',
    };
  }

  const kiloId = kiloMetaSessionId(meta);

  if (kiloId) {
    return {
      source: 'kilo',
      id: kiloId,
      note: 'from x-kilo-session-id metadata',
    };
  }

  const claudeId = process.env.CLAUDE_CODE_SESSION_ID;

  if (claudeId) {
    return {
      source: 'claude',
      id: claudeId,
      note: 'from CLAUDE_CODE_SESSION_ID env',
    };
  }

  const kiloEnvId = process.env.KILO_SESSION_ID?.trim();

  if (kiloEnvId) {
    return {
      source: 'kilo',
      id: kiloEnvId,
      note: 'from KILO_SESSION_ID env',
    };
  }

  return null;
}

function resolveCaller(args, context) {
  const exact = exactCaller(context.meta);

  if (exact) return exact;

  if (
    args.caller_source
    && args.caller_id
  ) {
    return {
      source: args.caller_source,
      id: String(args.caller_id),
      note: 'from read_session arguments',
    };
  }

  return null;
}

// ---------- 适配器 ----------

const codexAdapter = {
  source: 'codex',

  find(id) {
    return id
      ? findFile(
        CODEX_SESSIONS,
        new RegExp(escapeRegExp(id)),
      )
      : null;
  },

  parse: parseCodex,

  list(project, limit) {
    const out = [];

    for (
      const f
      of listFilesDeep(CODEX_SESSIONS, '.jsonl')
    ) {
      const sm = readJsonlUntil(
        f,
        12,
        r => (
          r.type === 'session_meta'
            ? r
            : null
        ),
      );

      if (!sm) continue;

      const cwd = sm.payload?.cwd;

      if (project && cwd !== project) {
        continue;
      }

      const sid = sm.payload?.id
        || sm.payload?.session_id
        || path.basename(f)
          .match(/([0-9a-f-]{36})/)?.[1];

      if (!sid) continue;

      const firstUser = readJsonlUntil(
        f,
        300,
        r => (
          r.type === 'event_msg'
          && r.payload?.type === 'user_message'
            ? r
            : null
        ),
      );

      let st;

      try {
        st = fs.statSync(f);
      } catch {
        continue;
      }

      out.push({
        id: sid,
        source: 'codex',
        cwd,
        ts: st.mtime.toISOString(),
        summary: extractCodexReq(
          firstUser?.payload?.message || '',
        ).slice(0, 80),
        file: f,
        size: st.size,
      });
    }

    return out
      .sort(sortByTimeDesc)
      .slice(0, limit || 50);
  },
};

const claudeAdapter = {
  source: 'claude',

  find(id, project) {
    if (!id) return null;

    const dirs = project
      ? [
        path.join(
          CLAUDE_PROJECTS,
          encodeProject(project),
        ),
        CLAUDE_PROJECTS,
      ]
      : [CLAUDE_PROJECTS];

    for (const d of dirs) {
      if (!fs.existsSync(d)) continue;

      const direct = path.join(
        d,
        id + '.jsonl',
      );

      if (fs.existsSync(direct)) {
        return direct;
      }

      let entries;

      try {
        entries = fs.readdirSync(d, {
          withFileTypes: true,
        });
      } catch {
        continue;
      }

      for (const ent of entries) {
        if (
          ent.isDirectory()
          && !ent.isSymbolicLink()
        ) {
          const f = path.join(
            d,
            ent.name,
            id + '.jsonl',
          );

          if (fs.existsSync(f)) {
            return f;
          }
        }
      }
    }

    return null;
  },

  parse: parseClaude,

  list(project, limit) {
    const encoded = project
      && path.join(
        CLAUDE_PROJECTS,
        encodeProject(project),
      );

    let dirs = [];

    if (encoded && fs.existsSync(encoded)) {
      dirs = [encoded];
    } else if (fs.existsSync(CLAUDE_PROJECTS)) {
      try {
        dirs = fs
          .readdirSync(CLAUDE_PROJECTS, {
            withFileTypes: true,
          })
          .filter(d => (
            d.isDirectory()
            && !d.isSymbolicLink()
          ))
          .map(d => path.join(
            CLAUDE_PROJECTS,
            d.name,
          ));
      } catch {}
    }

    const out = [];

    for (const d of dirs) {
      let entries;

      try {
        entries = fs.readdirSync(d, {
          withFileTypes: true,
        });
      } catch {
        continue;
      }

      for (const ent of entries) {
        if (
          !ent.isFile()
          || !ent.name.endsWith('.jsonl')
        ) {
          continue;
        }

        const f = path.join(d, ent.name);

        let st;

        try {
          st = fs.statSync(f);
        } catch {
          continue;
        }

        const firstUser = readJsonlUntil(
          f,
          100,
          r => (
            r.type === 'user'
            && !r.isSidechain
              ? r
              : null
          ),
        );

        const c = firstUser?.message?.content;

        const summary = Array.isArray(c)
          ? c.find(x => x.type === 'text')?.text || ''
          : typeof c === 'string'
            ? c
            : '';

        const cwd = firstUser?.cwd || null;

        if (
          project
          && cwd
          && cwd !== project
        ) {
          continue;
        }

        out.push({
          id: path.basename(f, '.jsonl'),
          source: 'claude',
          cwd,
          ts: st.mtime.toISOString(),
          summary: summary.slice(0, 80),
          file: f,
          size: st.size,
        });
      }
    }

    return out
      .sort(sortByTimeDesc)
      .slice(0, limit || 50);
  },
};

const kiloAdapter = {
  source: 'kilo',

  find(id) {
    return (
      id
      && kiloScalar(
        `SELECT 1 FROM session WHERE id=${sqlString(id)} LIMIT 1`,
      )
    )
      ? KILO_DB
      : null;
  },

  parse(file, sid) {
    const meta = {
      source: 'kilo',
      cwd: null,
      git: null,
      sessionId: sid || null,
      tsRange: [null, null],
    };

    const msgs = [];
    const files = [];

    if (!sid) {
      return {
        meta,
        msgs,
        files,
      };
    }

    try {
      const session = kiloQuery(
        `SELECT directory FROM session WHERE id=${sqlString(sid)} LIMIT 1`,
      );

      if (
        isRows(session)
        && session.length
      ) {
        meta.cwd = session[0].directory;
      }

      const ms = kiloQuery(
        `SELECT id, data, time_created FROM message WHERE session_id=${sqlString(sid)} ORDER BY time_created, id`,
      );

      if (!isRows(ms)) {
        return {
          meta,
          msgs,
          files,
        };
      }

      for (const m of ms) {
        let d;

        try {
          d = typeof m.data === 'string'
            ? JSON.parse(m.data)
            : m.data;
        } catch {
          continue;
        }

        const ts = toIso(m.time_created);

        if (ts) {
          if (!meta.tsRange[0]) {
            meta.tsRange[0] = ts;
          }

          meta.tsRange[1] = ts;
        }

        const rows = kiloQuery(
          `SELECT data FROM part WHERE message_id=${sqlString(m.id)} ORDER BY id`,
        );

        if (!isRows(rows)) continue;

        const parts = rows
          .map(p => {
            try {
              return typeof p.data === 'string'
                ? JSON.parse(p.data)
                : p.data;
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        const text = parts
          .filter(p => p.type === 'text')
          .map(p => p.text || '')
          .join('\n');

        if (
          d.role === 'user'
          && text
        ) {
          msgs.push({
            ts,
            role: 'user',
            text,
          });
        } else if (d.role === 'assistant') {
          if (text) {
            msgs.push({
              ts,
              role: 'assistant',
              text,
            });
          }

          for (const p of parts) {
            if (p.type === 'tool') {
              msgs.push({
                ts,
                role: 'tool',
                name: p.tool,
                args: p.state?.input,
                result: p.state?.output || '',
                isError: p.state?.status === 'error',
              });
            } else if (p.type === 'file') {
              files.push({
                ts,
                path: p.filename || '',
                type: 'file',
                content: p.url?.slice(0, 500) || '',
              });
            }
          }
        }
      }
    } catch (e) {
      setError(`kilo parse: ${e.message}`);
    }

    return {
      meta,
      msgs,
      files,
    };
  },

  list(project, limit) {
    if (!fs.existsSync(KILO_DB)) {
      return [];
    }

    let where = '';

    if (project) {
      const q = sqlString(project);

      where = [
        ` WHERE directory=${q}`,
        ` OR ${q} LIKE rtrim(directory,'/')||'/%'`,
      ].join('');
    }

    const rows = kiloQuery(
      `SELECT id,directory,title,time_updated FROM session${where} ORDER BY time_updated DESC LIMIT ${safeLimit(limit, 50)}`,
    );

    if (!isRows(rows)) return [];

    const size = fs.statSync(KILO_DB).size;

    return rows.map(r => ({
      id: r.id,
      source: 'kilo',
      cwd: r.directory,
      ts: toIso(r.time_updated),
      summary: String(r.title || '').slice(0, 80),
      file: KILO_DB,
      size,
    }));
  },
};

const copilotAdapter = {
  source: 'copilot',

  find(id) {
    return id
      ? findFile(
        COPILOT_STORAGE_ROOTS.length === 1
          ? COPILOT_STORAGE_ROOTS[0]
          : path.join(
            HOME,
            'Library/Application Support/Code/User/workspaceStorage',
          ),
        new RegExp(
          `[\\\\/]GitHub\\.copilot-chat[\\\\/]transcripts[\\\\/]${escapeRegExp(id)}\\.jsonl$`,
        ),
      ) || listCopilotTranscriptFiles().find(
        file => path.basename(file, '.jsonl') === id,
      )
      : null;
  },

  parse(file, sid) {
    return parseCopilot(file, sid);
  },

  list(project, limit) {
    const out = [];

    for (const file of listCopilotTranscriptFiles()) {
      const sid = path.basename(file, '.jsonl');
      const parsed = parseCopilot(file, sid);

      if (
        project
        && parsed.meta.cwd
        && parsed.meta.cwd !== project
      ) {
        continue;
      }

      let st;

      try {
        st = fs.statSync(file);
      } catch {
        continue;
      }

      const firstUser = parsed.msgs.find(
        message => message.role === 'user',
      );

      out.push({
        id: parsed.meta.sessionId || sid,
        source: 'copilot',
        cwd: parsed.meta.cwd,
        ts: st.mtime.toISOString(),
        summary: String(firstUser?.text || '').slice(0, 80),
        file,
        size: st.size,
      });
    }

    return out
      .sort(sortByTimeDesc)
      .slice(0, limit || 50);
  },
};

const adapters = [
  codexAdapter,
  claudeAdapter,
  kiloAdapter,
  copilotAdapter,
];

const adapterBySource = source => (
  adapters.find(a => a.source === source)
);

// ---------- 渲染 ----------

function briefArgs(name, args) {
  if (!args) return '';

  if (
    ['shell', 'exec_command', 'Bash']
      .includes(name)
  ) {
    return args.command
      || args.cmd
      || JSON.stringify(args).slice(0, 200);
  }

  if (
    [
      'Edit',
      'Write',
      'apply_patch',
      'update_plan',
    ].includes(name)
  ) {
    return args.file_path
      || args.path
      || '';
  }

  try {
    return JSON.stringify(args).slice(0, 200);
  } catch {
    return String(args).slice(0, 200);
  }
}

function renderMsgBlock(m) {
  const tag = m.role === 'tool'
    ? `tool:${m.name || 'unknown'}`
    : m.role;

  const lines = [
    `### [${m.ts || '?'}] ${tag}`,
  ];

  if (m.role === 'tool') {
    lines.push(
      `**${m.name || 'unknown'}** ${briefArgs(m.name, m.args)}`,
    );

    const result = contentToText(m.result);

    if (result) {
      const max = m.isError
        ? 1500
        : MAX_TOOL_RESULT_CHARS;

      lines.push(
        `${m.isError ? '> ERROR' : '**result**'}:\n`
        + '```text\n'
        + result.slice(0, max)
        + (
          result.length > max
            ? '\n…[truncated]'
            : ''
        )
        + '\n```',
      );
    }
  } else {
    lines.push(m.text || '');
  }

  return lines.join('\n');
}

function render(
  { meta, msgs, files },
  since,
  maxChars,
) {
  const limit = Math.max(
    1000,
    Math.min(
      500000,
      Number(maxChars) || MAX_OUTPUT_CHARS,
    ),
  );

  const L = [];
  let len = 0;

  const can = s => (
    len + s.length + 1 <= limit
  );

  const push = s => {
    L.push(s);
    len += s.length + 1;
  };

  push(
    `# Session ${meta.sessionId || '?'}  (source=${meta.source})`,
  );

  if (meta.cwd) {
    push(`- cwd: ${meta.cwd}`);
  }

  if (meta.git) {
    push(`- git: ${JSON.stringify(meta.git)}`);
  }

  if (meta.tsRange[0]) {
    push(
      `- time: ${meta.tsRange[0]} → ${meta.tsRange[1]}`,
    );
  }

  if (since) {
    push(`- incremental since: ${since}`);
  }

  push(
    `- messages: ${msgs.length}, files changed: ${files.length}`,
  );

  push('');

  let shownMsgs = 0;
  let shownFiles = 0;
  let lastMsgSeq = null;
  let lastFileSeq = null;
  let lastMsgTs = null;
  let lastFileTs = null;

  let msgTruncated = false;
  let fileTruncated = false;

  if (msgs.length) {
    push('## Messages');

    for (const m of msgs) {
      const block = renderMsgBlock(m);

      if (!can(block)) {
        msgTruncated = true;
        break;
      }

      push(block);

      shownMsgs++;
      lastMsgSeq = m.seq;
      lastMsgTs = m.ts;
    }
  } else {
    push('_(无新增消息)_');
  }

  if (msgTruncated) {
    const note = [
      '',
      `…[truncated: 共 ${msgs.length} 条消息，`,
      `本次显示 ${shownMsgs} 条；`,
      '下次水印读取会从未返回处继续]',
    ].join('');

    if (can(note)) {
      push(note);
    }
  } else if (files.length) {
    if (can('## Files Changed')) {
      push('## Files Changed');
    }

    for (const f of files) {
      const body = f.diff
        ? [
          '```diff',
          f.diff,
          '```',
        ].join('\n')
        : f.content != null
          ? [
            '```text',
            String(f.content).slice(0, 4000),
            '```',
          ].join('\n')
          : '';

      const block = [
        `### ${f.path || '(unknown)'} (${f.type || 'unknown'})`,
        body,
      ].join('\n');

      if (!can(block)) {
        fileTruncated = true;
        break;
      }

      push(block);

      shownFiles++;
      lastFileSeq = f.seq;
      lastFileTs = f.ts;
    }
  }

  return {
    text: L.join('\n'),
    shownMsgs,
    shownFiles,
    lastMsgSeq,
    lastFileSeq,
    lastMsgTs,
    lastFileTs,
    truncated: msgTruncated || fileTruncated,
  };
}

// ---------- 工具 ----------

function tool_list_sessions({
  source,
  project,
  limit,
} = {}) {
  limit = safeLimit(limit, 20);

  let out = [];

  for (const a of adapters) {
    if (
      source
      && a.source !== source
    ) {
      continue;
    }

    try {
      out = out.concat(
        a.list(project, limit),
      );
    } catch (e) {
      setError(
        `list ${a.source} fail: ${e.message}`,
      );
    }
  }

  return out
    .sort(sortByTimeDesc)
    .slice(0, limit)
    .map(o => ({
      id: o.id,
      source: o.source,
      cwd: o.cwd,
      ts: o.ts,
      summary: String(o.summary || '')
        .replace(/\n/g, ' ')
        .slice(0, 80),
      sizeK: Math.round(
        (o.size || 0) / 1024,
      ),
    }));
}

function resolveSession(id, source) {
  if (source) {
    const a = adapterBySource(source);

    return {
      adapter: a,
      file: a?.find(id) || null,
    };
  }

  const matches = adapters
    .map(a => ({
      adapter: a,
      file: a.find(id),
    }))
    .filter(x => x.file);

  if (matches.length > 1) {
    return {
      error: [
        'session id 同时命中 ',
        matches
          .map(x => x.adapter.source)
          .join(', '),
        '，请传 source',
      ].join(''),
    };
  }

  return matches[0] || {
    adapter: null,
    file: null,
  };
}

function filterWM(items, seq, ts) {
  if (seq != null) {
    return items.filter(x => x.seq > seq);
  }

  if (ts != null) {
    return items.filter(
      x => isAfter(x.ts, ts),
    );
  }

  return items;
}

function tool_read_session(
  args = {},
  context = {},
) {
  const {
    id,
    source,
    since,
    max_chars,
    use_watermark = true,
    reset_watermark = false,
  } = args;

  if (!id) {
    return {
      content: [{
        type: 'text',
        text: 'read_session: id 不能为空',
      }],
      isError: true,
    };
  }

  const resolved = resolveSession(
    id,
    source,
  );

  if (resolved.error) {
    return {
      content: [{
        type: 'text',
        text: resolved.error,
      }],
      isError: true,
    };
  }

  if (
    !resolved.adapter
    || !resolved.file
  ) {
    return {
      content: [{
        type: 'text',
        text: `session not found: ${id}`,
      }],
      isError: true,
    };
  }

  if (
    since
    && toEpoch(since) == null
  ) {
    return {
      content: [{
        type: 'text',
        text: `since 不是有效时间: ${since}`,
      }],
      isError: true,
    };
  }

  const parsed = resolved.adapter.parse(
    resolved.file,
    id,
  );

  parsed.meta.source = resolved.adapter.source;

  parsed.msgs.forEach((x, i) => {
    x.seq = i + 1;
  });

  parsed.files.forEach((x, i) => {
    x.seq = i + 1;
  });

  const caller = resolveCaller(
    args,
    context,
  );

  const key = caller
    ? [
      `${caller.source}:${caller.id}`,
      `${resolved.adapter.source}:${parsed.meta.sessionId || id}`,
    ].join('->')
    : null;

  const wm = key
    ? loadWM()
    : {};

  if (
    key
    && reset_watermark
  ) {
    delete wm[key];
    saveWM(wm);
  }

  const stored = (
    key
    && use_watermark
    && !since
    && !reset_watermark
  )
    ? normalizeWM(wm[key])
    : null;

  let msgs = parsed.msgs;
  let files = parsed.files;

  if (since) {
    msgs = msgs.filter(
      m => isAfter(m.ts, since),
    );

    files = files.filter(
      f => isAfter(f.ts, since),
    );
  } else if (stored) {
    msgs = filterWM(
      msgs,
      stored.msgSeq,
      stored.msgTs,
    );

    files = filterWM(
      files,
      stored.fileSeq,
      stored.fileTs,
    );
  }

  const rendered = render(
    {
      meta: parsed.meta,
      msgs,
      files,
    },
    since || (
      stored
        ? 'stored watermark'
        : null
    ),
    max_chars,
  );

  if (
    key
    && use_watermark
  ) {
    const old = normalizeWM(wm[key]) || {
      msgSeq: null,
      fileSeq: null,
      msgTs: null,
      fileTs: null,
    };

    wm[key] = {
      msgSeq: rendered.lastMsgSeq
        ?? old.msgSeq,
      fileSeq: rendered.lastFileSeq
        ?? old.fileSeq,
      msgTs: rendered.lastMsgTs
        ?? old.msgTs,
      fileTs: rendered.lastFileTs
        ?? old.fileTs,
      updatedAt: new Date().toISOString(),
    };

    saveWM(wm);
  }

  return {
    content: [{
      type: 'text',
      text: rendered.text,
    }],
    session_id: parsed.meta.sessionId || id,
    source: resolved.adapter.source,
    returned: rendered.shownMsgs,
    returned_files: rendered.shownFiles,
    last_ts: rendered.lastFileTs
      || rendered.lastMsgTs
      || null,
    truncated: rendered.truncated,
    watermark_used: !!stored,
  };
}

function tool_current_session(
  args = {},
  context = {},
) {
  const exact = exactCaller(context.meta);

  if (
    exact
    && (
      !args.source
      || args.source === exact.source
    )
  ) {
    return exact;
  }

  const hint = args.source
    || process.env.SB_CALLER_SOURCE;

  return {
    source: 'unknown',
    id: null,
    note: hint
      ? `未从 ${hint} 获取精确会话身份；不会按 cwd 推断`
      : '未获取到调用方精确会话身份；不会按 cwd 推断',
  };
}

// ---------- MCP ----------

const tools = [
  {
    name: 'list_sessions',
    description: '列出 codex/claude/kilo/copilot 会话',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: [
            'codex',
            'claude',
            'kilo',
            'copilot',
          ],
        },
        project: {
          type: 'string',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'read_session',
    description: '读取会话；默认使用调用方到目标会话的持久化水印，只推进实际返回的内容',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        source: {
          type: 'string',
          enum: [
            'codex',
            'claude',
            'kilo',
            'copilot',
          ],
        },
        since: {
          type: 'string',
        },
        max_chars: {
          type: 'integer',
          minimum: 1000,
          maximum: 500000,
        },
        caller_source: {
          type: 'string',
          enum: [
            'codex',
            'claude',
            'kilo',
            'copilot',
          ],
        },
        caller_id: {
          type: 'string',
        },
        caller_cwd: {
          type: 'string',
        },
        use_watermark: {
          type: 'boolean',
          default: true,
        },
        reset_watermark: {
          type: 'boolean',
          default: false,
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'current_session',
    description: '识别当前调用方会话；仅接受精确 metadata/env，不按 cwd 推断',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: [
            'codex',
            'claude',
            'kilo',
            'copilot',
          ],
        },
        cwd: {
          type: 'string',
        },
      },
      additionalProperties: false,
    },
  },
];

function rpcError(
  id,
  code,
  message,
  data,
) {
  return {
    id: id ?? null,
    error: {
      code,
      message,
      ...(
        data === undefined
          ? {}
          : { data }
      ),
    },
  };
}

function toolError(message) {
  return {
    content: [{
      type: 'text',
      text: String(message),
    }],
    isError: true,
  };
}

async function handle(req) {
  if (
    !req
    || typeof req !== 'object'
    || Array.isArray(req)
  ) {
    return rpcError(
      null,
      -32600,
      'Invalid Request',
    );
  }

  const { id, method } = req;
  const notification = id === undefined;

  const params = (
    req.params
    && typeof req.params === 'object'
  )
    ? req.params
    : {};

  if (typeof method !== 'string') {
    return notification
      ? null
      : rpcError(
        id,
        -32600,
        'Invalid Request',
      );
  }

  if (method === 'initialize') {
    const requested = params.protocolVersion;

    const protocolVersion
      = SUPPORTED_PROTOCOL_VERSIONS.includes(
        requested,
      )
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0];

    return notification
      ? null
      : {
        id,
        result: {
          protocolVersion,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: 'session-bridge',
            version: '0.3.0',
          },
        },
      };
  }

  if (
    method === 'notifications/initialized'
    || method.startsWith('notifications/')
  ) {
    return null;
  }

  if (method === 'ping') {
    return notification
      ? null
      : {
        id,
        result: {},
      };
  }

  // 兼容部分 Codex 客户端在握手后发出的非标准当前会话探测。
  if (method === 'currentSession') {
    return notification
      ? null
      : {
        id,
        result: tool_current_session(
          params,
          { meta: params._meta },
        ),
      };
  }

  if (method === 'tools/list') {
    return notification
      ? null
      : {
        id,
        result: {
          tools,
        },
      };
  }

  if (method === 'tools/call') {
    if (notification) return null;

    const name = params.name;

    const args = (
      params.arguments
      && typeof params.arguments === 'object'
    )
      ? params.arguments
      : {};

    const context = {
      meta: params._meta,
    };

    try {
      let result;

      if (name === 'list_sessions') {
        result = tool_list_sessions(args);
      } else if (name === 'read_session') {
        result = tool_read_session(
          args,
          context,
        );
      } else if (name === 'current_session') {
        result = tool_current_session(
          args,
          context,
        );
      } else {
        result = toolError(
          `unknown tool: ${name}`,
        );
      }

      if (result?.content) {
        return {
          id,
          result,
        };
      }

      return {
        id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(
              result,
              null,
              2,
            ),
          }],
        },
      };
    } catch (e) {
      return {
        id,
        result: toolError(
          e.stack || e,
        ),
      };
    }
  }

  return notification
    ? null
    : rpcError(
      id,
      -32601,
      `Method not found: ${method}`,
    );
}

function writeResponse(res) {
  if (!res) return;

  const text = JSON.stringify({
    jsonrpc: '2.0',
    ...res,
  });

  dbg('SENT', text);

  process.stdout.write(
    text + '\n',
  );
}

function startServer() {
  dbg(
    'START',
    `pid=${process.pid} argv=${JSON.stringify(process.argv)}`,
  );

  const rl = createInterface({
    input: process.stdin,
    terminal: false,
    crlfDelay: Infinity,
  });

  rl.on('line', line => {
    if (!line.trim()) return;

    dbg('RECV', line);

    let req;

    try {
      req = JSON.parse(line);
    } catch (e) {
      writeResponse(
        rpcError(
          null,
          -32700,
          'Parse error',
          e.message,
        ),
      );

      return;
    }

    Promise
      .resolve(handle(req))
      .then(writeResponse)
      .catch(e => {
        writeResponse(
          rpcError(
            req?.id,
            -32603,
            'Internal error',
            e.stack || e,
          ),
        );
      });
  });
}

// ---------- CLI ----------

function runCli(argv) {
  const [cmd, ...rest] = argv;

  if (cmd === '--list') {
    console.log(
      JSON.stringify(
        tool_list_sessions({
          source: rest[0],
          project: rest[1],
          limit: 10,
        }),
        null,
        2,
      ),
    );

    return 0;
  }

  if (cmd === '--read') {
    const r = tool_read_session({
      id: rest[0],
      source: rest[1],
      since: rest[2],
      max_chars: rest[3],
      use_watermark: false,
    });

    console.log(
      r.content?.[0]?.text
      || JSON.stringify(r, null, 2),
    );

    return r.isError ? 1 : 0;
  }

  if (cmd === '--current') {
    console.log(
      JSON.stringify(
        tool_current_session({
          source: rest[0],
          cwd: rest[1],
        }),
        null,
        2,
      ),
    );

    return 0;
  }

  if (cmd === '--last-error') {
    console.log(
      lastError || 'null',
    );

    return 0;
  }

  console.log(
    '用法: --list [source] [project]'
    + ' | --read <id> [source] [since] [max_chars]'
    + ' | --current [source] [cwd]',
  );

  return cmd ? 1 : 0;
}

if (process.argv.length > 2) {
  process.exitCode = runCli(
    process.argv.slice(2),
  );
} else {
  startServer();
}

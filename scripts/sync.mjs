#!/usr/bin/env node
/**
 * 单一源同步脚本 — shared-agent-config → Kilo / Codex / cc-switch / Claude / Copilot
 * 单一源: mcp/mcp-servers.shared.jsonc + mcp/secrets.env + skills/ + commands/ + prompts/
 *
 * 用法:
 *   node sync.mjs all --write       → MCP 配置 + Skills 表 + 符号链接 + AGENTS.md
 *   node sync.mjs cc-switch --write → 仅 cc-switch (MCP + Skills + 符号链接)
 *   node sync.mjs kilo --write      → 仅 Kilo MCP 配置
 *   node sync.mjs copilot --write   → Copilot MCP + Skills + 全局指令
 *
 * Copilot 同步说明:
 *   - Skills: ~/.copilot/skills/ 符号链接
 *   - 指令: ~/.copilot/instructions/shared-agent-config.instructions.md
 *   - MCP: 写入 VS Code 用户级 mcp.json；仅保留 features.shared.jsonc 中明确启用的共享服务
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(__dirname);

function loadSecrets() {
  const envFile = path.join(REPO, 'mcp', 'secrets.env');
  const secrets = {};
  if (!fs.existsSync(envFile)) {
    console.error('[warn] mcp/secrets.env 不存在，密钥占位符将保留原样');
    return secrets;
  }
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    secrets[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return secrets;
}

function stripJSONC(raw) {
  let result = '';
  let inString = false;
  let inBlockComment = false;
  let inLineComment = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inBlockComment) {
      if (ch === '*' && raw[i + 1] === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (inLineComment) {
      if (ch === '\n') { inLineComment = false; result += ch; }
      continue;
    }
    if (inString) {
      result += ch;
      if (ch === '\\') { result += raw[i + 1] || ''; i++; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; result += ch; continue; }
    if (ch === '/' && raw[i + 1] === '*') { inBlockComment = true; i++; continue; }
    if (ch === '/' && raw[i + 1] === '/') { inLineComment = true; i++; continue; }
    result += ch;
  }
  return result;
}

function loadMCPDefs() {
  const raw = fs.readFileSync(path.join(REPO, 'mcp', 'mcp-servers.shared.jsonc'), 'utf8');
  return JSON.parse(stripJSONC(raw));
}

function loadFeatureConfig() {
  const file = path.join(REPO, 'features.shared.jsonc');
  if (!fs.existsSync(file)) return { mcp: {}, skills: {} };
  return JSON.parse(stripJSONC(fs.readFileSync(file, 'utf8')));
}

function applyFeatureConfig(mcpDefs, featureConfig) {
  return Object.fromEntries(Object.entries(mcpDefs).filter(([name, def]) => {
    const configured = featureConfig.mcp?.[name];
    return configured === true;
  }));
}

function replacePlaceholders(mcpDefs, secrets) {
  let zentaoBaseOrigin = '';
  let zentaoApiPrefix = '/api.php/v1';
  let zentaoTokenPath = '/api.php/v1/tokens';
  if (secrets.ZENTAO_BASE_URL) {
    try {
      const zentaoUrl = new URL(secrets.ZENTAO_BASE_URL);
      const deploymentPath = zentaoUrl.pathname.replace(/\/+$/, '');
      zentaoBaseOrigin = zentaoUrl.origin;
      zentaoApiPrefix = `${deploymentPath}/api.php/v1`;
      zentaoTokenPath = `${zentaoApiPrefix}/tokens`;
    } catch {
      // 保留安全默认值，让现有同步流程继续输出缺少密钥的配置。
    }
  }
  const str = JSON.stringify(mcpDefs, null, 2);
  const placeholders = [
    ['__AGENT_BROWSER_CDP__', secrets.AGENT_BROWSER_CDP || '9222'],
    ['__MASTERGO_TOKEN__', secrets.MASTERGO_TOKEN || ''],
    ['__YAPI_TOKEN__', secrets.YAPI_TOKEN || ''],
    ['__YUQUE_TOKEN__', secrets.YUQUE_TOKEN || ''],
    ['__YUQUE_BASE_URL__', secrets.YUQUE_BASE_URL || 'https://www.yuque.com/api/v2'],
    ['__ZHIPU_API_KEY__', secrets.ZHIPU_API_KEY || ''],
    ['__MEMOS_API_KEY__', secrets.MEMOS_API_KEY || ''],
    ['__MEMOS_USER_ID__', secrets.MEMOS_USER_ID || ''],
    ['__MEMOS_CHANNEL__', secrets.MEMOS_CHANNEL || 'MODELSCOPE'],
    ['__ZENTAO_BASE_URL__', secrets.ZENTAO_BASE_URL || ''],
    ['__ZENTAO_BASE_ORIGIN__', zentaoBaseOrigin],
    ['__ZENTAO_API_PREFIX__', zentaoApiPrefix],
    ['__ZENTAO_TOKEN_PATH__', zentaoTokenPath],
    ['__ZENTAO_ACCOUNT__', secrets.ZENTAO_ACCOUNT || ''],
    ['__ZENTAO_PASSWORD__', secrets.ZENTAO_PASSWORD || ''],
    // 跨平台命令路径：转义为 JSON 字符串字面量，避免 Windows 反斜杠破坏 JSON 解析。
    ['__NODE_BIN__', JSON.stringify(process.execPath).slice(1, -1)],
    ['__REPO_DIR__', JSON.stringify(REPO).slice(1, -1)],
  ];
  let result = str;
  for (const [ph, val] of placeholders) {
    result = result.replaceAll(ph, val);
  }
  return JSON.parse(result);
}

function expandHome(filePath) {
  if (filePath.startsWith('~/')) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

/** 将值转成 SQLite 字符串字面量，避免生成 SQL 时被单引号截断。 */
function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** 使用 Node 内置 SQLite 执行 SQL 到 cc-switch 数据库，替代外部 sqlite3 CLI。 */
function applySqlToCcSwitch(dbPath, sql, label) {
  let db;
  try {
    db = new DatabaseSync(dbPath);
    db.exec(sql);
    return true;
  } catch (e) {
    console.warn(`[warn] 写入 cc-switch ${label} 失败:`, e.message);
    return false;
  } finally {
    if (db) db.close();
  }
}

function resolveCommands(mcpDefs) {
  const resolved = {};
  for (const [name, def] of Object.entries(mcpDefs)) {
    const d = { ...def };
    if (d.type === 'local' && Array.isArray(d.command)) {
      d.command = d.command.map(c => expandHome(c));
    }
    resolved[name] = d;
  }
  return resolved;
}

const PREVIEW_SECRET_KEY = /(password|token|api[_-]?key|secret|cookie|authorization)/i;
const PREVIEW_SECRET_ARGUMENT = /(--(?:[^=]*token|[^=]*password|[^=]*key|[^=]*secret)=).*/i;

/** 仅用于预览输出，避免把已解析的认证值打印到终端或日志。 */
function redactPreviewValue(value, key = '') {
  if (PREVIEW_SECRET_KEY.test(key)) return '<redacted>';
  if (typeof value === 'string') {
    return value.replace(PREVIEW_SECRET_ARGUMENT, '$1<redacted>');
  }
  if (Array.isArray(value)) return value.map((item) => redactPreviewValue(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactPreviewValue(childValue, childKey),
      ])
    );
  }
  return value;
}

function redactMcpDefsForPreview(mcpDefs) {
  return redactPreviewValue(mcpDefs);
}

/** 将共享 MCP 定义合并到 Kilo kilo.jsonc */
function syncToKilo(mcpDefs, writeMode) {
  const kiloPath = expandHome('~/.config/kilo/kilo.jsonc');
  if (!fs.existsSync(kiloPath)) {
    console.warn('[warn] ~/.config/kilo/kilo.jsonc 不存在，跳过 Kilo MCP 同步');
    return;
  }

  const previewRoot = { mcp: redactMcpDefsForPreview(mcpDefs) };
  const mcpField = JSON.stringify(previewRoot, null, 2)
    .split('\n')
    .slice(1, -1)
    .join('\n');

  if (!writeMode) {
    console.log('# Kilo MCP 配置 (预览) — 使用 --write 写入');
    console.log(mcpField);
    return;
  }

  const content = fs.readFileSync(kiloPath, 'utf8');
  let root;
  try {
    root = JSON.parse(stripJSONC(content));
  } catch (e) {
    console.warn('[warn] ~/.config/kilo/kilo.jsonc 不是有效 JSONC，跳过:', e.message);
    return;
  }

  // mcp 内部有多层嵌套对象，不能用非贪婪正则替换字段，否则会留下旧配置残片。
  root.mcp = mcpDefs;
  fs.writeFileSync(kiloPath, JSON.stringify(root, null, 2) + '\n');
  console.log('[ok] 已写入 ~/.config/kilo/kilo.jsonc (mcp 字段)');
}

/** 将共享 MCP 定义转换为 Codex TOML 并合并 */
function syncToCodex(mcpDefs, writeMode) {
  const codexPath = expandHome('~/.codex/config.toml');
  if (!fs.existsSync(codexPath)) {
    console.warn('[warn] ~/.codex/config.toml 不存在，跳过 Codex MCP 同步');
    return;
  }

  const tomlLines = [];
  tomlLines.push('[mcp_servers]');
  tomlLines.push('');

  const sourceDefs = writeMode ? mcpDefs : redactMcpDefsForPreview(mcpDefs);
  for (const [name, def] of Object.entries(sourceDefs)) {
    tomlLines.push(`[mcp_servers.${name}]`);
    if (def.type === 'local') {
      tomlLines.push('type = "stdio"');
      tomlLines.push(`command = "${def.command[0]}"`);
      const args = def.command.slice(1).map(a => `"${a}"`);
      if (args.length === 1) {
        tomlLines.push(`args = [${args[0]}]`);
      } else {
        tomlLines.push('args = [');
        tomlLines.push(args.map(a => `    ${a}`).join(',\n'));
        tomlLines.push('  ]');
      }
      if (def.environment && Object.keys(def.environment).length > 0) {
        tomlLines.push('');
        tomlLines.push(`[mcp_servers.${name}.env]`);
        for (const [k, v] of Object.entries(def.environment)) {
          tomlLines.push(`${k} = "${v}"`);
        }
      }
    } else if (def.type === 'remote') {
      tomlLines.push('type = "http"');
      tomlLines.push(`url = "${def.url}"`);
      if (def.headers && Object.keys(def.headers).length > 0) {
        tomlLines.push('');
        tomlLines.push(`[mcp_servers.${name}.headers]`);
        for (const [k, v] of Object.entries(def.headers)) {
          tomlLines.push(`${k} = "${v}"`);
        }
      }
    }
    tomlLines.push('');
  }

  const newMCP = tomlLines.join('\n');

  if (writeMode) {
    let content = fs.readFileSync(codexPath, 'utf8');
    // 匹配 [mcp_servers] 段到下一个顶级 section 或 EOF
    const mcpSection = /\[mcp_servers\]([\s\S]*?)(?=\n\[(?:projects|model_providers|tools|hooks)\b|\n*$)/;
    if (mcpSection.test(content)) {
      content = content.replace(mcpSection, newMCP);
    } else {
      content = content.trimEnd() + '\n' + newMCP + '\n';
    }
    fs.writeFileSync(codexPath, content);
    console.log('[ok] 已写入 ~/.codex/config.toml (mcp_servers 段)');
  } else {
    console.log('# Codex config.toml MCP 段 (预览) — 使用 --write 写入');
    console.log(newMCP);
  }
}

/** 将共享 MCP 定义转换为 Claude Code 的 mcpServers 对象（含密钥脱敏预览）。 */
function buildMcpServers(mcpDefs, writeMode) {
  const sourceDefs = writeMode ? mcpDefs : redactMcpDefsForPreview(mcpDefs);
  const servers = {};
  for (const [name, def] of Object.entries(sourceDefs)) {
    if (def.type === 'local') {
      const s = { command: def.command[0] };
      if (def.command.length > 1) s.args = def.command.slice(1);
      if (def.environment && Object.keys(def.environment).length > 0) s.env = { ...def.environment };
      servers[name] = s;
    } else if (def.type === 'remote') {
      const s = { type: 'url', url: def.url };
      if (def.headers && Object.keys(def.headers).length > 0) s.headers = { ...def.headers };
      servers[name] = s;
    }
  }
  return servers;
}

/** 将共享 MCP 定义转换为 .mcp.json 格式文件 (ClaudeCode / Copilot 共用)。 */
function syncToMcpJson(mcpDefs, writeMode, destPath) {
  const servers = buildMcpServers(mcpDefs, writeMode);
  const content = JSON.stringify({ mcpServers: servers }, null, 2) + '\n';

  if (!writeMode) {
    console.log(`# ${destPath} (预览) — 使用 --write 写入`);
    console.log(content);
    return;
  }

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(destPath, content);
  console.log(`[ok] 已写入 ${destPath}`);
}

/** 将共享 MCP 定义合并写入 Claude Code 的 ~/.claude.json（顶层 + 各项目，实现全局生效）。 */
function syncToClaudeMcp(mcpDefs, writeMode) {
  const servers = buildMcpServers(mcpDefs, writeMode);
  const claudeJson = expandHome('~/.claude.json');

  if (!writeMode) {
    console.log('# ~/.claude.json mcpServers (预览) — 使用 --write 写入');
    console.log(JSON.stringify({ mcpServers: servers }, null, 2));
    return;
  }

  let config = {};
  if (fs.existsSync(claudeJson)) {
    try {
      config = JSON.parse(fs.readFileSync(claudeJson, 'utf8'));
    } catch (e) {
      console.warn('[warn] ~/.claude.json 不是有效 JSON，跳过:', e.message);
      return;
    }
  }

  // 顶层 mcpServers：兼容旧版全局语义
  config.mcpServers = servers;
  // 各项目 mcpServers：Claude Code 2.x 按项目读取
  let projectCount = 0;
  if (config.projects && typeof config.projects === 'object') {
    for (const [projectPath, project] of Object.entries(config.projects)) {
      if (project && typeof project === 'object') {
        project.mcpServers = servers;
        projectCount++;
      }
    }
  }

  const backupPath = `${claudeJson}.bak`;
  if (fs.existsSync(claudeJson)) fs.copyFileSync(claudeJson, backupPath);
  fs.writeFileSync(claudeJson, JSON.stringify(config, null, 2) + '\n');
  console.log(`[ok] 已写入 ~/.claude.json 的 mcpServers（全局 + ${projectCount} 个项目），备份: ${backupPath}`);
}

/** 将共享 MCP 定义写入 cc-switch SQLite 数据库，供 cc-switch 管理界面识别。 */
function syncToCcSwitch(mcpDefs, writeMode) {
  const dbPath = expandHome('~/.cc-switch/cc-switch.db');
  if (!fs.existsSync(dbPath)) {
    console.warn('[warn] ~/.cc-switch/cc-switch.db 不存在，跳过 cc-switch MCP 同步');
    return;
  }

  const statements = [];
  const sourceDefs = writeMode ? mcpDefs : redactMcpDefsForPreview(mcpDefs);
  for (const [name, def] of Object.entries(sourceDefs)) {
    const serverConfig = {};
    if (def.type === 'local') {
      serverConfig.type = 'stdio';
      serverConfig.command = def.command[0];
      if (def.command.length > 1) serverConfig.args = def.command.slice(1);
      if (def.environment && Object.keys(def.environment).length > 0) serverConfig.env = { ...def.environment };
    } else if (def.type === 'remote') {
      serverConfig.type = 'http';
      serverConfig.url = def.url;
      if (def.headers && Object.keys(def.headers).length > 0) serverConfig.headers = { ...def.headers };
    }

    statements.push(`INSERT INTO mcp_servers (
  id, name, server_config, description, homepage, docs, tags,
  enabled_claude, enabled_codex, enabled_gemini, enabled_opencode, enabled_hermes
)
VALUES (
  ${quoteSql(name)}, ${quoteSql(name)}, ${quoteSql(JSON.stringify(serverConfig))},
  '', '', '', '[]',
  1, 1, 0, 0, 0
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  server_config = excluded.server_config,
  enabled_claude = excluded.enabled_claude,
  enabled_codex = excluded.enabled_codex;`);
  }

  // 全量同步：先删不在 shared 定义中的，再 upsert（同一事务，原子性由 sqlite3 写锁保证）
  const sharedIds = Object.keys(mcpDefs).map(id => quoteSql(id));
  if (sharedIds.length > 0) {
    statements.unshift(`DELETE FROM mcp_servers WHERE id NOT IN (${sharedIds.join(',')});`);
  } else {
    statements.unshift('DELETE FROM mcp_servers;');
  }

  const sql = statements.join('\n\n') + '\n';

  if (!writeMode) {
    console.log('# cc-switch MCP SQL 预览 — 使用 --write 写入');
    console.log(sql);
    return;
  }

  const backupPath = path.join(path.dirname(dbPath), 'backups', `cc-switch.db.mcp.${Date.now()}.bak`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(dbPath, backupPath);

  if (!applySqlToCcSwitch(dbPath, sql, 'MCP')) return;

  console.log(`[ok] 已写入 ~/.cc-switch/cc-switch.db (mcp_servers 表)，备份: ${backupPath}`);
}

/** 将 shared-agent-config/skills/ 目录全量同步到 cc-switch skills 表。 */
function syncSkillsToCcSwitch(writeMode, enabledSkills = {}) {
  const dbPath = expandHome('~/.cc-switch/cc-switch.db');
  if (!fs.existsSync(dbPath)) {
    console.warn('[warn] ~/.cc-switch/cc-switch.db 不存在，跳过 cc-switch Skills 同步');
    return;
  }

  const skillsDir = path.join(REPO, 'skills');
  if (!fs.existsSync(skillsDir)) {
    console.error('[warn] skills 目录不存在，跳过');
    return;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skillDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && enabledSkills[e.name] === true);

  const statements = [];
  for (const dir of skillDirs) {
    const absPath = path.resolve(path.join(skillsDir, dir.name));
    const skillMd = path.join(absPath, 'SKILL.md');

    let description = '';
    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, 'utf8');
      description = content.slice(0, 200).replace(/\n/g, ' ').trim();
    }

    statements.push(`INSERT INTO skills (
  id, name, description, directory,
  enabled_claude, enabled_codex, enabled_gemini, enabled_opencode, enabled_hermes,
  installed_at, updated_at
)
VALUES (
  ${quoteSql(dir.name)}, ${quoteSql(dir.name)}, ${quoteSql(description)},
  ${quoteSql(absPath)},
  1, 1, 0, 0, 0,
  ${Math.floor(Date.now() / 1000)}, ${Math.floor(Date.now() / 1000)}
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  directory = excluded.directory,
  enabled_claude = excluded.enabled_claude,
  enabled_codex = excluded.enabled_codex,
  updated_at = excluded.updated_at;`);
  }

  // 全量同步：先删不在 skills 目录中的
  const sharedIds = skillDirs.map(d => quoteSql(d.name));
  if (sharedIds.length > 0) {
    statements.unshift(`DELETE FROM skills WHERE id NOT IN (${sharedIds.join(',')});`);
  } else {
    statements.unshift('DELETE FROM skills;');
  }

  const sql = statements.join('\n\n') + '\n';

  if (!writeMode) {
    console.log(`# cc-switch Skills SQL 预览 (${skillDirs.length} 个) — 使用 --write 写入`);
    console.log(sql);
    return;
  }

  const backupPath = path.join(path.dirname(dbPath), 'backups', `cc-switch.db.skills.${Date.now()}.bak`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(dbPath, backupPath);

  if (!applySqlToCcSwitch(dbPath, sql, 'Skills')) return;

  console.log(`[ok] 已写入 ~/.cc-switch/cc-switch.db (skills 表，${skillDirs.length} 个)，备份: ${backupPath}`);
}

/** 返回 VS Code 用户配置目录，兼容 Windows / macOS / Linux。 */
function getVscodeUserDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Code', 'User');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Code', 'User');
}

/** 将启用的共享 MCP 覆盖写入 VS Code 用户级 mcp.json。 */
function syncToCopilotMcp(mcpDefs, writeMode) {
  const mcpPath = path.join(getVscodeUserDir(), 'mcp.json');
  const sharedServers = {};
  for (const [name, def] of Object.entries(mcpDefs)) {
    if (def.type === 'local') {
      sharedServers[name] = { type: 'stdio', command: def.command[0] };
      if (def.command.length > 1) sharedServers[name].args = def.command.slice(1);
      if (def.environment && Object.keys(def.environment).length > 0) sharedServers[name].env = { ...def.environment };
    } else if (def.type === 'remote') {
      sharedServers[name] = { type: 'http', url: def.url };
      if (def.headers && Object.keys(def.headers).length > 0) sharedServers[name].headers = { ...def.headers };
    }
  }

  if (!writeMode) {
    console.log(`# Copilot MCP (${Object.keys(sharedServers).length} 个共享服务) -> ${mcpPath}`);
    return;
  }

  let config = { servers: {}, inputs: [] };
  if (fs.existsSync(mcpPath)) {
    const raw = fs.readFileSync(mcpPath, 'utf8');
    // 空文件（如 VS Code 生成的占位）视为空配置，继续覆盖写入。
    if (raw.trim() !== '') {
      try {
        config = JSON.parse(raw);
      } catch (error) {
        console.warn(`[warn] VS Code MCP 配置不是有效 JSON，跳过: ${mcpPath}: ${error.message}`);
        return;
      }
    }
  }
  const previousCount = Object.keys(config.servers || {}).length;
  config.servers = sharedServers;
  if (!Array.isArray(config.inputs)) config.inputs = [];
  fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
  fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`  [ok] Copilot MCP: 已同步 ${Object.keys(sharedServers).length} 个启用服务，已清理 ${Math.max(previousCount - Object.keys(sharedServers).length, 0)} 个额外服务，现有 ${Object.keys(config.servers).length} 个服务`);
}

/** 同步 Copilot Skills，并删除 VS Code 会发现的所有禁用 Skill 遗留项。 */
function syncCopilotSkills(writeMode, enabledSkills = {}) {
  const sourceDir = path.join(REPO, 'skills');
  const destinationDir = path.join(expandHome('~/.copilot'), 'skills');
  const copilotDiscoveryDirs = [
    destinationDir,
    path.join(expandHome('~/.claude'), 'skills'),
  ];
  const legacyDiscoveryDirs = [
    path.join(expandHome('~/.agents'), 'skills'),
    path.join(expandHome('~/.claude'), 'skills'),
  ];
  if (!fs.existsSync(sourceDir)) {
    console.warn(`[warn] Copilot Skills 源目录不存在，跳过: ${sourceDir}`);
    return;
  }
  const allSkillDirs = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));
  const skillDirs = allSkillDirs.filter(entry => enabledSkills[entry.name] === true);
  const disabledSkillDirs = allSkillDirs.filter(entry => enabledSkills[entry.name] !== true);

  if (!writeMode) {
    console.log(`# Copilot Skills (${skillDirs.length} 个) -> ${destinationDir}`);
    return;
  }
  fs.mkdirSync(destinationDir, { recursive: true });
  let changed = 0;
  let removed = 0;
  for (const skill of disabledSkillDirs) {
    const sourcePath = path.resolve(path.join(sourceDir, skill.name));
    for (const directory of copilotDiscoveryDirs) {
      const destination = path.join(directory, skill.name);
      try {
        if (fs.readlinkSync(destination) === sourcePath || fs.readlinkSync(destination) === `${sourcePath}${path.sep}`) {
          fs.unlinkSync(destination);
          removed++;
        }
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'EINVAL') console.error(`[warn] 清理禁用 Copilot Skill 失败 ${destination}: ${error.message}`);
      }
    }

    for (const directory of legacyDiscoveryDirs) {
      if (!fs.existsSync(directory)) continue;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name !== skill.name && !entry.name.startsWith(`${skill.name}.`)) continue;
        const legacyPath = path.join(directory, entry.name);
        if (fs.lstatSync(legacyPath).isSymbolicLink()) continue;
        fs.rmSync(legacyPath, { recursive: true, force: true });
        removed++;
        console.log(`  [ok] 已删除禁用 Skill: ${legacyPath}`);
      }
    }
  }
  for (const skill of skillDirs) {
    if (ensureSymlink(path.join(sourceDir, skill.name), path.join(destinationDir, skill.name))) changed++;
  }
  console.log(`  [ok] Copilot Skills: ${changed ? `已更新 ${changed} 个，` : ''}已清理 ${removed} 个禁用项，现有 ${skillDirs.length} 个启用项`);
}

/** 同步 Copilot 全局指令文件。 */
function syncToCopilot(writeMode) {
  const copilotDir = expandHome('~/.copilot');
  if (!fs.existsSync(copilotDir)) {
    if (writeMode) {
      fs.mkdirSync(copilotDir, { recursive: true });
      console.log('[ok] 已创建 ~/.copilot/');
    } else {
      console.log('# Copilot 同步 (预览) — ~/.copilot 不存在，使用 --write 创建');
      return;
    }
  }

  const PROMPTS = path.join(REPO, 'prompts');
  const AGENT_MD_SRC = path.join(PROMPTS, 'agent.md');

  // 指令文件
  const instructionsDir = path.join(copilotDir, 'instructions');
  const instructionsFile = path.join(instructionsDir, 'shared-agent-config.instructions.md');
  const fallbackInstructions = `---
name: 'Shared Agent Config'
description: '核心 Agent 协作规则（中文输出、结束报告、代码风格）'
applyTo: '**/*'
---

# Shared Agent Config — 核心规则

## 中文输出

- 所有面向用户的内容使用简体中文。
- 代码、命令、文件路径、API 名称、标识符、专有名词保留英文。

## 结束报告

每轮回复末尾必须包含结束报告模板：

\`\`\`md
**结束报告**
- 当前对话引用ID：...
- 完成内容：...
- 验证与风险：...
- 后续建议：...
- 当前会话可累积知识点（长期记忆）：...
- 回归检查：...
- 防御代码：...
\`\`\`

## 代码风格

- 新增函数、组件、接口补齐 JSDoc。
- 不写低信息量注释（代码复述），复杂逻辑写设计原因/边界/权衡。
- 保持实现简洁收敛，避免冗余抽象。
- TSX 属性统一用展开对象形式 \`<Component {...{ prop: value }} />\`。

## 工作流

- 改代码前先了解上下文、Mimic 现有风格。
- 禁止随意升级依赖大版本或切换包管理器。
- 禁止弱化测试资产。

## MCP 工具

Copilot 通过 VS Code 设置 \`chat.mcp.discovery.enabled: true\` 自动发现 \`~/.mcp.json\`。
`;
  const instructionBody = fs.existsSync(AGENT_MD_SRC)
    ? fs.readFileSync(AGENT_MD_SRC, 'utf8').trim()
    : fallbackInstructions.split('---\n').slice(2).join('---\n').trim();
  const INSTRUCTIONS_CONTENT = `---
name: 'Shared Agent Config'
description: '由 shared-agent-config/prompts/agent.md 同步的全局规则'
applyTo: '**/*'
---

${instructionBody}\n`;

  if (!writeMode) {
    console.log(`# Copilot 指令文件 (预览) -> ${instructionsFile}`);
    console.log(INSTRUCTIONS_CONTENT);
  } else {
    if (!fs.existsSync(AGENT_MD_SRC)) console.log('[warn] prompts/agent.md 不存在，指令文件使用内置回退规则');
    fs.mkdirSync(instructionsDir, { recursive: true });
    const current = fs.existsSync(instructionsFile) ? fs.readFileSync(instructionsFile, 'utf8') : '';
    if (current === INSTRUCTIONS_CONTENT) {
      console.log(`  [ok] Copilot 指令: 已是最新`);
    } else {
      fs.writeFileSync(instructionsFile, INSTRUCTIONS_CONTENT);
      console.log(`  [ok] Copilot 指令: ${current ? '已更新' : '已创建'} -> ${instructionsFile}`);
    }
  }

}

function ensureSymlink(src, dst) {
  if (!fs.existsSync(src)) return false;
  const srcAbs = path.resolve(src);
  // Windows 上创建符号链接需要管理员权限，改用 junction（目录联接）避免 EPERM
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  const makeLink = () => fs.symlinkSync(srcAbs, dst, linkType);
  try {
    const current = fs.readlinkSync(dst);
    if (current === srcAbs || current === srcAbs + path.sep) return false;
    fs.unlinkSync(dst);
    makeLink();
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') { makeLink(); return true; }
    if (e.code === 'EINVAL' && fs.existsSync(dst)) {
      fs.rmSync(dst, { recursive: true, force: true });
      makeLink();
      return true;
    }
    console.error(`[warn] 符号链接失败 ${dst}: ${e.message}`);
    return false;
  }
}

/** 创建 skills/commands/prompts 符号链接 + AGENTS.md，对应原 sync-all.sh 的文件系统部分。 */
function syncFilesystem(writeMode, enabledSkills = {}) {
  const SKILLS = path.join(REPO, 'skills');
  const COMMANDS = path.join(REPO, 'commands');
  const PROMPTS = path.join(REPO, 'prompts');
  const AGENT_MD_SRC = path.join(PROMPTS, 'agent.md');

  if (!writeMode) {
    console.log('# 文件系统同步 (符号链接 + AGENTS.md) - 预览 — 使用 --write 写入');
    const entries = fs.readdirSync(SKILLS, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.') && enabledSkills[e.name] === true);
    console.log(`  skills: ${entries.length} 个`);
    console.log(`  commands: ${fs.existsSync(COMMANDS) ? fs.readdirSync(COMMANDS).length : 0} 个`);
    return;
  }

  const targets = [];

  // Kilo（未安装则跳过，避免创建无意义的空目录）
  const kiloDir = expandHome('~/.config/kilo');
  if (fs.existsSync(path.join(kiloDir, 'kilo.jsonc'))) {
    targets.push({ dest: path.join(kiloDir, 'skills'), src: SKILLS, label: 'Kilo skills' });
    targets.push({ dest: path.join(kiloDir, 'commands'), src: COMMANDS, label: 'Kilo commands' });
  }

  // Codex
  const codexDir = expandHome('~/.codex');
  targets.push({ dest: path.join(codexDir, 'skills'), src: SKILLS, label: 'Codex skills' });
  targets.push({ dest: path.join(codexDir, 'prompts'), src: COMMANDS, label: 'Codex prompts' });

  // cc-switch
  const csDir = expandHome('~/.cc-switch');
  targets.push({ dest: path.join(csDir, 'skills'), src: SKILLS, label: 'cc-switch skills' });

  // Claude
  const claudeDir = expandHome('~/.claude');
  targets.push({ dest: path.join(claudeDir, 'skills'), src: SKILLS, label: 'Claude skills' });
  targets.push({ dest: path.join(claudeDir, 'workflows'), src: COMMANDS, label: 'Claude workflows' });

  // VS Code 还会发现该目录中的用户级 Skills。
  const agentsDir = expandHome('~/.agents');
  targets.push({ dest: path.join(agentsDir, 'skills'), src: SKILLS, label: 'Agent skills' });

  for (const { dest, src, label } of targets) {
    fs.mkdirSync(dest, { recursive: true });
    let created = 0, updated = 0, skipped = 0;
    if (!fs.existsSync(src)) { console.log(`  [skip] ${label}: 源目录不存在`); continue; }
    const isSkillTarget = src === SKILLS;
    if (isSkillTarget) {
      const enabledSkillNames = new Set(fs.readdirSync(src, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && enabledSkills[entry.name] === true)
        .map(entry => entry.name));
      for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || enabledSkillNames.has(entry.name)) continue;
        fs.rmSync(path.join(dest, entry.name), { recursive: true, force: true });
        skipped++;
      }
    }
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dest, entry.name);
      if (isSkillTarget && enabledSkills[entry.name] !== true) continue;
      const result = ensureSymlink(srcPath, dstPath);
      if (result === true) {
        if (fs.existsSync(dstPath) && fs.readlinkSync(dstPath) !== srcPath) updated++;
        else created++;
      } else {
        skipped++;
      }
    }
    if (created + updated + skipped === 0) {
      console.log(`  [ok] ${label}: (空目录)`);
    } else {
      const parts = [];
      if (created) parts.push(`+${created}`);
      if (updated) parts.push(`~${updated}`);
      if (skipped) parts.push(`=${skipped}`);
      console.log(`  [ok] ${label}: ${parts.join(' ')} -> ${dest}`);
    }
  }

  // AGENTS.md / CLAUDE.md
  const codexAgents = path.join(codexDir, 'AGENTS.md');
  const claudeAgents = path.join(claudeDir, 'CLAUDE.md');
  const agentsContent = `立即加载 ${AGENT_MD_SRC}`;
  for (const [p, label] of [[codexAgents, 'Codex AGENTS.md'], [claudeAgents, 'Claude CLAUDE.md']]) {
    if (!fs.existsSync(AGENT_MD_SRC)) { console.log(`  [skip] ${label}: prompts/agent.md 不存在`); continue; }
    const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (current === agentsContent) { console.log(`  [ok] ${label}: 已是最新`); continue; }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, agentsContent);
    console.log(`  [ok] ${label}: ${current ? '已更新' : '已创建'} -> ${p}`);
  }
}

// --- main ---
const args = process.argv.slice(2);
const target = args[0];
const writeMode = args.includes('--write');

const rawDefs = loadMCPDefs();
const secrets = loadSecrets();
const featureConfig = loadFeatureConfig();
const enabledDefs = applyFeatureConfig(rawDefs, featureConfig);
const resolved = resolveCommands(replacePlaceholders(enabledDefs, secrets));
const enabledSkills = featureConfig.skills || {};

switch (target) {
  case 'kilo':
    syncToKilo(resolved, writeMode);
    break;
  case 'codex':
    syncToCodex(resolved, writeMode);
    break;
  case 'claude':
    syncToClaudeMcp(resolved, writeMode);
    break;
  case 'copilot':
    syncToCopilotMcp(resolved, writeMode);
    if (writeMode) console.log('');
    syncToCopilot(writeMode);
    if (writeMode) console.log('');
    syncCopilotSkills(writeMode, enabledSkills);
    break;
  case 'cc-switch':
    syncToCcSwitch(resolved, writeMode);
    if (writeMode) console.log('');
    syncSkillsToCcSwitch(writeMode, enabledSkills);
    if (writeMode) console.log('');
    syncFilesystem(writeMode, enabledSkills);
    break;
  case 'all':
    syncToKilo(resolved, writeMode);
    if (writeMode) console.log('');
    syncToCodex(resolved, writeMode);
    if (writeMode) console.log('');
    syncToClaudeMcp(resolved, writeMode);
    if (writeMode) console.log('');
    syncToCcSwitch(resolved, writeMode);
    if (writeMode) console.log('');
    syncSkillsToCcSwitch(writeMode, enabledSkills);
    if (writeMode) console.log('');
    syncFilesystem(writeMode, enabledSkills);
    if (writeMode) console.log('');
    syncToCopilotMcp(resolved, writeMode);
    if (writeMode) console.log('');
    syncToCopilot(writeMode);
    if (writeMode) console.log('');
    syncCopilotSkills(writeMode, enabledSkills);
    break;
  default:
    console.error('用法: node sync.mjs <kilo|codex|claude|copilot|cc-switch|all> [--write]');
    process.exit(1);
}

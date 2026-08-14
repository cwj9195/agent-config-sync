#!/usr/bin/env node
/**
 * frontend-design-agent 独立工具：api-contract.md → OpenAPI 3.0 JSON
 *
 * 定位：本脚本不在 skill 的 workflow 默认环节。当需要把前端契约导出、导入 YApi
 * （团队单一源，YApi 原生按 OpenAPI 3.0 / components.schemas 存储）时，手动运行。
 * skill 本身仍只产出 api-contract.md。
 *
 * 用法:
 *   rtk node scripts/contract-to-swagger.mjs <api-contract.md> [openapi.json] \
 *       [--base-path /] [--title "..."] [--host "..."]
 *
 * 解析：§0 全局包装(ApiRespResult<T>/BasePageResult<T>) + §2~§N 模块接口
 * （### API-Mx-xxx + 请求方式/接口路径 + #### 请求参数|XxxReq + #### XxxDto/Resp），
 * 全局扫描所有 #### 类名表（含「子实体 Xxx」「公共 DTO」段）保证 $ref 不悬空；
 * 仍有悬空则补占位 schema。泛型 ApiRespResult<T>/BasePageResult<T> 按接口实例化。
 * 精度限制：响应 data「单对象 vs 数组」以接口详情 Dto 表为准；§1 总览若标
 * 普通响应<XxxDto[]>（数组），需人工复核（脚本按单对象生成）。
 */
import fs from 'node:fs';
import process from 'node:process';

const REF = (name) => '#/components/schemas/' + name; // OpenAPI 3.0 $ref 路径

// ---------- 参数 ----------
const argv = process.argv.slice(2);
let mdPath = '', outPath = '', basePath = '/', title = 'API Contract', host = '';
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--base-path') basePath = argv[++i];
  else if (a === '--title') title = argv[++i];
  else if (a === '--host') host = argv[++i];
  else if (!mdPath) mdPath = a;
  else if (!outPath) outPath = a;
}
if (!mdPath) {
  console.error('用法: contract-to-swagger.mjs <api-contract.md> [openapi.json] [--base-path /] [--title T] [--host H]');
  process.exit(1);
}
if (!outPath) outPath = mdPath.replace(/\.md$/i, '.openapi.json');

const lines = fs.readFileSync(mdPath, 'utf8').split('\n');
const warnings = [];

// ---------- 基本工具 ----------
const splitRow = (line) =>
  String(line).replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
const scalarMap = {
  string: { type: 'string' }, char: { type: 'string' }, text: { type: 'string' },
  integer: { type: 'integer', format: 'int32' }, int: { type: 'integer', format: 'int32' },
  long: { type: 'integer', format: 'int64' },
  number: { type: 'number' }, double: { type: 'number', format: 'double' }, float: { type: 'number', format: 'float' }, bigdecimal: { type: 'number' },
  boolean: { type: 'boolean' }, bool: { type: 'boolean' },
  object: { type: 'object' }, map: { type: 'object' }, any: { type: 'object' },
  date: { type: 'string', format: 'date' }, datetime: { type: 'string', format: 'date-time' }, localdatetime: { type: 'string', format: 'date-time' },
};
const isScalarName = (n) => Object.prototype.hasOwnProperty.call(scalarMap, n.toLowerCase());
const isClassName = (s) => /^[A-Za-z][\w<>]*$/.test(s);
const headClassName = (head) => {
  const m2 = String(head).match(/([A-Za-z][\w<>]+)/g);
  return m2 ? m2[m2.length - 1].replace(/[<>]/g, '') : '';
};
const toSchema = (raw) => {
  const t = String(raw || '').replace(/`/g, '').replace(/\\([<>])/g, '$1').trim();
  if (!t || t === '-' || t === 'T') return { type: 'object' };
  let m = t.match(/^\[([^\]]+)\]\([^)]*\)\[\]$/);
  if (m) return { type: 'array', items: toSchema(m[1]) };
  m = t.match(/^\[([^\]]+)\]\([^)]*\)$/);
  if (m) return toSchema(m[1]);
  m = t.match(/^(?:List|Set|Collection|Array)<(.+)>$/i);
  if (m) return { type: 'array', items: toSchema(m[1]) };
  if (/^Map<.+>$/i.test(t)) return { type: 'object' };
  m = t.match(/^(.+?)\[\]$/);
  if (m) return { type: 'array', items: toSchema(m[1]) };
  if (isScalarName(t)) return { ...scalarMap[t.toLowerCase()] };
  if (isClassName(t)) return { $ref: REF(t.replace(/[<>]/g, '')) };
  warnings.push(`无法识别类型 "${raw}"，按 string 处理`);
  return { type: 'string' };
};
const parseTable = (fromIdx) => {
  let i = fromIdx;
  while (i < lines.length && !lines[i].trim().startsWith('|')) i++;
  if (i >= lines.length) return { fields: [], end: fromIdx };
  const header = splitRow(lines[i]); i++;
  if (i < lines.length && /^[\s|:-]+$/.test(lines[i]) && lines[i].includes('-')) i++;
  const rows = [];
  while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i++; }
  const col = (name) => header.findIndex((h) => h === name);
  const f = col('字段'), ty = col('类型'), rq = col('必填'), ds = col('说明');
  const fields = rows.map((row) => ({
    name: (row[f < 0 ? 0 : f] || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, '').trim(),
    type: (row[ty < 0 ? 1 : ty] || '').trim(),
    required: rq >= 0 ? /是|required|true/i.test(row[rq] || '') : false,
    desc: (row[ds < 0 ? row.length - 1 : ds] || '').trim(),
  })).filter((x) => x.name && x.name !== '字段');
  return { fields, end: i };
};

// ---------- §0 全局包装 ----------
const findSectionFields = (name) => {
  const idx = lines.findIndex((l) => new RegExp('^####\\s+' + name).test(l.trim()));
  return idx < 0 ? null : parseTable(idx + 1).fields;
};
const apiRespFields = findSectionFields('ApiRespResult');
const pageFields = findSectionFields('BasePageResult');
if (!apiRespFields) warnings.push('未找到 §0 ApiRespResult<T> 包装定义（将用兜底字段）');
if (!pageFields) warnings.push('未找到 §0 BasePageResult<T> 包装定义（将用兜底字段）');

// ---------- schemas（components.schemas） ----------
const defs = {};
const ensureDef = (name, fields) => {
  name = String(name).replace(/[<>]/g, '');
  if (!name || defs[name]) return;
  const props = {}, required = [];
  for (const f of fields) {
    props[f.name] = { ...toSchema(f.type), ...(f.desc ? { description: f.desc } : {}) };
    if (f.required) required.push(f.name);
  }
  defs[name] = { type: 'object', properties: props, ...(required.length ? { required } : {}) };
};
for (let i = 0; i < lines.length; i++) {
  const hm = lines[i].match(/^####\s+(.+)$/);
  if (!hm) continue;
  const nm = headClassName(hm[1]);
  if (!nm || nm === 'ApiRespResult' || nm === 'BasePageResult') continue;
  const { fields } = parseTable(i + 1);
  if (fields.length) ensureDef(nm, fields);
}
const wrapNormal = (dataName) => {
  const w = `ApiRespResultOf${dataName}`;
  if (defs[w]) return w;
  const props = {};
  for (const f of (apiRespFields || [{name:'code',type:'String'},{name:'msg',type:'String'},{name:'data',type:'T'},{name:'success',type:'Boolean'}])) {
    props[f.name] = f.name === 'data' ? { $ref: REF(dataName) } : toSchema(f.type);
  }
  defs[w] = { type: 'object', properties: props };
  return w;
};
const wrapPage = (dtoName) => {
  const p = `BasePageResultOf${dtoName}`;
  if (!defs[p]) {
    const props = {};
    for (const f of (pageFields || [{name:'current',type:'Integer'},{name:'size',type:'Integer'},{name:'total',type:'Integer'},{name:'records',type:'T[]'}])) {
      props[f.name] = f.name === 'records' ? { type: 'array', items: { $ref: REF(dtoName) } } : toSchema(f.type);
    }
    defs[p] = { type: 'object', properties: props };
  }
  return wrapNormal(p);
};

// ---------- 解析接口 ----------
const ifaceRe = /^###\s+(API-[A-Za-z0-9-]+)\s*[：:]\s*(.+?)\s*$/;
const ifaces = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(ifaceRe);
  if (!m) continue;
  let end = lines.length;
  for (let j = i + 1; j < lines.length; j++) if (/^#{2,3}\s/.test(lines[j])) { end = j; break; }
  const block = lines.slice(i, end);
  const pick = (key) => {
    const l = block.find((x) => x.includes(key));
    if (!l) return '';
    return l.slice(l.indexOf(key) + key.length).replace(/[：:`\s]+/g, ' ').trim();
  };
  const method = pick('**请求方式**').toUpperCase();
  const ppath = pick('**接口路径**');
  const tables = [];
  for (let k = 0; k < block.length; k++) {
    const hm = block[k].match(/^####\s+(.+)$/);
    if (!hm) continue;
    const { fields } = parseTable(i + k + 1);
    if (fields.length) tables.push({ head: hm[1].trim(), fields });
  }
  ifaces.push({ id: m[1], name: m[2].trim(), method, path: ppath, tables });
}

// ---------- paths（OpenAPI 3.0：requestBody / responses.content） ----------
const paths = {};
let countOk = 0;
for (const f of ifaces) {
  if (!f.method || !f.path) { warnings.push(`${f.id}: 缺 method/path，跳过`); continue; }
  const reqTable = f.tables.find((t) => /Req$/.test(headClassName(t.head))) ||
                   f.tables.find((t) => /请求参数|请求$/.test(t.head));
  let requestBody = null;
  if (reqTable) {
    const cn = headClassName(reqTable.head);
    const isNamed = /Req$/.test(cn);
    const reqName = isNamed ? cn : `${f.id.replace(/-/g, '')}Req`;
    ensureDef(reqName, reqTable.fields);
    requestBody = { content: { 'application/json': { schema: { $ref: REF(reqName) } } } };
  }
  const respTable = f.tables.find((t) => {
    const cn = headClassName(t.head);
    return cn && /(Dto|Resp|Result|Vo)$/.test(cn);
  });
  let respSchema = { type: 'object' };
  if (respTable) {
    const dataName = headClassName(respTable.head);
    ensureDef(dataName, respTable.fields);
    const isPage = /\/(page|list)\b/i.test(f.path) ||
      (reqTable && reqTable.fields.some((x) => x.name === 'current') && reqTable.fields.some((x) => x.name === 'size')) ||
      /Page/i.test(dataName);
    respSchema = { $ref: REF(isPage ? wrapPage(dataName) : wrapNormal(dataName)) };
  } else {
    warnings.push(`${f.id}: 未识别响应 DTO，data 置空对象（可能为文件流/布尔/无返回）`);
  }
  const op = {
    summary: f.name,
    operationId: f.id,
    ...(requestBody ? { requestBody } : {}),
    responses: { '200': { description: 'OK', content: { 'application/json': { schema: respSchema } } } },
  };
  const key = f.path.replace(/\s+/g, '');
  paths[key] = paths[key] || {};
  if (paths[key][f.method.toLowerCase()]) warnings.push(`${f.id}: ${key} ${f.method} 已存在，覆盖`);
  paths[key][f.method.toLowerCase()] = op;
  countOk++;
}

// ---------- $ref 自检 + 占位兜底 ----------
const specStr = JSON.stringify({ paths, components: { schemas: defs } });
const missing = new Set();
let mm; const refRe = /"\$ref"\s*:\s*"#\/components\/schemas\/([^"]+)"/g;
while ((mm = refRe.exec(specStr))) if (!defs[mm[1]]) missing.add(mm[1]);

// ---------- 输出（OpenAPI 3.0） ----------
const doc = {
  openapi: '3.0.3',
  info: { title, version: '1.0.0' },
  ...(host ? { servers: [{ url: host + (basePath && basePath !== '/' ? basePath : '') }] } : {}),
  paths,
  components: { schemas: defs },
};
if (missing.size) {
  console.warn(`⚠ $ref 悬空(${missing.size})，补占位 schema: ${[...missing].slice(0, 30).join(', ')}`);
  for (const name of missing) {
    if (!defs[name]) defs[name] = { type: 'object', description: '⚠ 契约未提供定义，脚本占位' };
    warnings.push(`悬空 $ref: ${name} 契约未提供定义，已补占位`);
  }
} else {
  console.log('✔ $ref 自检通过（无悬空引用）');
}
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log(`✔ 接口 ${countOk}/${ifaces.length}，schemas ${Object.keys(defs).length}，paths ${Object.keys(paths).length}`);
console.log(`✔ 写入 ${outPath}`);
if (warnings.length) {
  console.warn(`⚠ ${warnings.length} 条警告(前 20):`);
  warnings.slice(0, 20).forEach((w) => console.warn('  - ' + w));
}

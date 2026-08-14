import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const serverPath = new URL('../dist/index.js', import.meta.url).pathname;
const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    ZENTAO_URL: 'http://127.0.0.1/zentao',
    ZENTAO_USERNAME: 'test-user',
    ZENTAO_PASSWORD: 'test-password',
  },
  stdio: ['pipe', 'pipe', 'ignore'],
});

let buffer = '';
let nextRequestId = 1;
const pending = new Map();

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  }
});

function request(method, params) {
  const id = nextRequestId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`MCP协议响应超时: ${method}`));
    }, 3000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
}

try {
  const initialized = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'local-smoke', version: '1.0.0' },
  });
  assert.equal(initialized.error, undefined);

  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  })}\n`);

  const listed = await request('tools/list', {});
  const names = listed.result.tools.map((tool) => tool.name);
  assert.ok(names.includes('getBugDetail'));
  assert.ok(names.includes('resolveBug'));
  assert.ok(names.includes('getMyTasks'));

  const configResponse = await request('tools/call', {
    name: 'getConfig',
    arguments: {},
  });
  const configText = configResponse.result.content[0].text;
  assert.equal(configText.includes('test-password'), false);

  console.log(JSON.stringify({
    protocolHandshake: true,
    compatibleTools: ['getBugDetail', 'resolveBug', 'getMyTasks'],
    configDoesNotExposePassword: true,
  }));
} finally {
  for (const reject of pending.values()) {
    reject(new Error('MCP协议冒烟测试结束'));
  }
  child.kill('SIGTERM');
}

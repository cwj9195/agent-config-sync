import assert from 'node:assert/strict';
import http from 'node:http';
import { ZentaoLegacyAPI } from '../dist/zentaoLegacyApi.js';

let sessionRequests = 0;
let loginRequests = 0;
let bugReads = 0;
let malformedBugReads = 0;
let invalidBugReads = 0;
let resolveWrites = 0;
let slowWrites = 0;

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');

  if (url.pathname === '/api-getSessionID.json') {
    sessionRequests += 1;
    sendJson(response, 200, {
      status: 'success',
      data: JSON.stringify({ sessionID: `session-${sessionRequests}` }),
    });
    return;
  }

  if (url.pathname === '/user-login.json') {
    loginRequests += 1;
    sendJson(response, 200, { status: 'success' });
    return;
  }

  if (url.pathname === '/bug-view-18008.json') {
    bugReads += 1;
    if (bugReads === 1) {
      sendJson(response, 200, { status: 'fail', message: '会话失效' });
      return;
    }
    sendJson(response, 200, {
      status: 'success',
      data: JSON.stringify({
        bug: {
          id: '18008',
          title: '会话恢复冒烟测试',
          status: 'active',
          severity: '2',
          steps: '',
        },
        product: { name: '本地测试产品' },
      }),
    });
    return;
  }

  if (url.pathname === '/bug-view-18009.json') {
    malformedBugReads += 1;
    if (malformedBugReads === 1) {
      sendJson(response, 200, {
        status: 'success',
        data: JSON.stringify({ product: { name: '缺少Bug节点' } }),
      });
      return;
    }
    sendJson(response, 200, {
      status: 'success',
      data: JSON.stringify({
        bug: {
          id: '18009',
          title: '响应结构恢复测试',
          status: 'active',
          severity: '2',
          steps: '',
        },
      }),
    });
    return;
  }

  if (url.pathname === '/bug-view-18010.json') {
    invalidBugReads += 1;
    sendJson(response, 200, {
      status: 'success',
      data: JSON.stringify({ product: { name: '始终缺少Bug节点' } }),
    });
    return;
  }

  if (url.pathname === '/bug-resolve-18008.json') {
    resolveWrites += 1;
    sendJson(response, 200, {
      result: 'success',
      message: '保存成功',
      closeModal: true,
      load: '/zentao/bug-view-18046.json',
    });
    return;
  }

  if (url.pathname === '/slow-write') {
    slowWrites += 1;
    setTimeout(() => sendJson(response, 200, { status: 'success' }), 120);
    return;
  }

  sendJson(response, 404, { status: 'fail', message: '未找到测试路由' });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const api = new ZentaoLegacyAPI({
    url: baseUrl,
    username: 'test-user',
    password: 'test-password',
    apiVersion: 'legacy',
    timeoutMs: 1000,
    sessionTtlMs: 100,
  });

  const bug = await api.getBugDetail(18008);
  assert.equal(bug.id, 18008);
  assert.equal(loginRequests, 2);
  assert.equal(sessionRequests, 2);

  const malformedApi = new ZentaoLegacyAPI({
    url: baseUrl,
    username: 'test-user',
    password: 'test-password',
    apiVersion: 'legacy',
    timeoutMs: 1000,
    sessionTtlMs: 100,
  });
  const beforeMalformedLogins = loginRequests;
  const beforeMalformedSessions = sessionRequests;
  const recoveredBug = await malformedApi.getBugDetail(18009);
  assert.equal(recoveredBug.id, 18009);
  assert.equal(malformedBugReads, 2);
  assert.equal(loginRequests - beforeMalformedLogins, 2);
  assert.equal(sessionRequests - beforeMalformedSessions, 2);

  await assert.rejects(
    malformedApi.getBugDetail(18010),
    /请求成功但响应结构异常: Bug 18010 详情/,
  );
  assert.equal(invalidBugReads, 2);

  await api.resolveBug(18008, {
    resolution: 'fixed',
    resolvedBuild: 'trunk',
    comment: '本地冒烟测试',
  });
  assert.equal(resolveWrites, 1);

  const slowApi = new ZentaoLegacyAPI({
    url: baseUrl,
    username: 'test-user',
    password: 'test-password',
    apiVersion: 'legacy',
    timeoutMs: 20,
    sessionTtlMs: 100,
  });
  await assert.rejects(
    slowApi.postRequest('/slow-write', { value: 'once' }),
    /timeout|超时/i,
  );
  assert.equal(slowWrites, 1);

  console.log(JSON.stringify({
    sessionRecovery: true,
    resolveWriteOnce: true,
    timeoutDoesNotDuplicatePost: true,
  }));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

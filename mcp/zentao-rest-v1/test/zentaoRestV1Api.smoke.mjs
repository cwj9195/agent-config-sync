import assert from 'node:assert/strict';
import http from 'node:http';
import { ZentaoRestV1API } from '../dist/zentaoRestV1Api.js';

let tokenRequests = 0;
let bugReads = 0;
let bugUpdates = 0;
let taskCreates = 0;
let taskReads = 0;
let legacySessionRequests = 0;
let legacyLoginRequests = 0;
let legacyBugReads = 0;
let bugUpdateBody = '';
let taskCreateBody = '';
let bugTitle = 'REST v1 Bug';

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function readBody(request, callback) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk.toString();
  });
  request.on('end', () => callback(body));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');

  if (url.pathname === '/api.php/v1/tokens') {
    tokenRequests += 1;
    sendJson(response, 201, { token: `rest-v1-token-${tokenRequests}` });
    return;
  }

  if (url.pathname === '/api.php/v1/bugs/18508' && request.method === 'GET') {
    bugReads += 1;
    sendJson(response, 200, {
      id: 18508,
      title: bugTitle,
      status: 'active',
      severity: 3,
      steps: '<p>REST v1 复现步骤</p>',
      openedDate: '2026-09-05 10:00:00',
      product: 33,
      productName: '前端研发组',
    });
    return;
  }

  if (url.pathname === '/api.php/v1/bugs/18508' && request.method === 'PUT') {
    bugUpdates += 1;
    readBody(request, (body) => {
      bugUpdateBody = body;
      bugTitle = JSON.parse(body).title || bugTitle;
      sendJson(response, 200, { status: 'active' });
    });
    return;
  }

  if (url.pathname === '/api.php/v1/bugs/18009') {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end("<b>Fatal error</b>: Class 'bugEntry' not found");
    return;
  }

  if (url.pathname === '/api.php/v1/executions/6837/tasks') {
    taskCreates += 1;
    readBody(request, (body) => {
      taskCreateBody = body;
      sendJson(response, 201, { id: 19000 });
    });
    return;
  }

  if (url.pathname === '/api.php/v1/tasks/19000') {
    taskReads += 1;
    sendJson(response, 200, {
      id: 19000,
      name: 'test',
      status: 'wait',
      pri: 3,
      execution: 6837,
      assignedTo: 'caiwenjia',
      estimate: 0.01,
      estStarted: '2026-09-05',
      deadline: '2026-09-05',
      desc: '完成问题排查和修复',
    });
    return;
  }

  if (url.pathname === '/api-getSessionID.json') {
    legacySessionRequests += 1;
    sendJson(response, 200, {
      status: 'success',
      data: JSON.stringify({ sessionID: `legacy-session-${legacySessionRequests}` }),
    });
    return;
  }

  if (url.pathname === '/user-login.json') {
    legacyLoginRequests += 1;
    sendJson(response, 200, { status: 'success' });
    return;
  }

  if (url.pathname === '/bug-view-18009.json') {
    legacyBugReads += 1;
    sendJson(response, 200, {
      status: 'success',
      data: JSON.stringify({
        bug: {
          id: '18009',
          title: 'Legacy 兜底 Bug',
          status: 'active',
          severity: '2',
          steps: '<p>Legacy 复现步骤</p>',
        },
        product: { name: 'Legacy 产品' },
      }),
    });
    return;
  }

  sendJson(response, 404, { status: 'fail', message: '未找到测试路由' });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const api = new ZentaoRestV1API({
    url: baseUrl,
    username: 'test-user',
    password: 'test-password',
    apiVersion: 'legacy',
    timeoutMs: 1000,
    sessionTtlMs: 100000,
  });

  const bug = await api.getBugDetail(18508);
  assert.equal(bug.id, 18508);
  assert.equal(bug.status, 'active');
  assert.equal(tokenRequests, 1);
  assert.equal(legacySessionRequests, 0);

  const updatedBug = await api.updateBug(18508, {
    title: 'REST v1 更新后的 Bug',
    keywords: 'REST v1 更新测试',
  });
  assert.equal(bugUpdates, 1);
  assert.equal(updatedBug.title, 'REST v1 更新后的 Bug');
  assert.equal(JSON.parse(bugUpdateBody).keywords, 'REST v1 更新测试');

  const task = await api.createTask({
    executionId: 6837,
    name: 'test',
    type: 'affair',
    assignedTo: 'caiwenjia',
    estimate: 0.01,
    estStarted: '2026-09-05',
    deadline: '2026-09-05',
    pri: 3,
    desc: '完成问题排查和修复',
  });
  assert.equal(taskCreates, 1);
  assert.equal(taskReads, 1);
  assert.equal(task.id, 19000);
  assert.equal(JSON.parse(taskCreateBody).execution, 6837);
  assert.equal(JSON.parse(taskCreateBody).type, 'affair');

  const fallbackApi = new ZentaoRestV1API({
    url: baseUrl,
    username: 'test-user',
    password: 'test-password',
    apiVersion: 'legacy',
    timeoutMs: 1000,
    sessionTtlMs: 100000,
  });
  const fallbackBug = await fallbackApi.getBugDetail(18009);
  assert.equal(fallbackBug.id, 18009);
  assert.equal(fallbackBug.title, 'Legacy 兜底 Bug');
  assert.equal(legacySessionRequests, 1);
  assert.equal(legacyLoginRequests, 1);
  assert.equal(legacyBugReads, 1);

  console.log(JSON.stringify({
    restV1BugRead: true,
    restV1BugUpdateReadBack: true,
    restV1TaskCreateReadBack: true,
    legacyReadFallback: true,
  }));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

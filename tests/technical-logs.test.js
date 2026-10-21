const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {
  createTechnicalLogService,
  sanitizeParams,
  buildLogQL,
  parseLokiStreams
} = require('../src/services/technical-log-service');
const { createTechnicalLogController } = require('../src/controllers/technical-log-controller');

test('sanitizeParams: Chỉ nhận dịch vụ, khoảng thời gian, nhóm lỗi được phép; giới hạn limit và keyword', () => {
  const defaults = sanitizeParams({});
  assert.equal(defaults.service, '');
  assert.equal(defaults.interval, '1h');
  assert.equal(defaults.errorGroup, '');
  assert.equal(defaults.keyword, '');
  assert.equal(defaults.limit, 100);

  const malicious = sanitizeParams({
    service: 'evil_service; drop table',
    interval: '100y',
    errorGroup: 'bad_group',
    q: 'a'.repeat(200) + '\n\rsecret',
    limit: '999999'
  });
  assert.equal(malicious.service, '');
  assert.equal(malicious.interval, '1h');
  assert.equal(malicious.errorGroup, '');
  assert.equal(malicious.keyword.length, 100);
  assert.ok(!malicious.keyword.includes('\n'));
  assert.equal(malicious.limit, 100);

  const valid = sanitizeParams({
    service: 'nginx',
    interval: '24h',
    errorGroup: '5xx',
    q: 'error timeout',
    limit: '50'
  });
  assert.equal(valid.service, 'nginx');
  assert.equal(valid.interval, '24h');
  assert.equal(valid.errorGroup, '5xx');
  assert.equal(valid.keyword, 'error timeout');
  assert.equal(valid.limit, 50);
});

test('buildLogQL: Tạo LogQL an toàn, cố định nhãn project="blog-cms", không chèn injection', () => {
  const qAll = buildLogQL({ service: '', errorGroup: '', keyword: '' });
  assert.equal(qAll, '{project="blog-cms",service=~"app|nginx|mysql|phpmyadmin"}');

  const qService = buildLogQL({ service: 'app', errorGroup: '', keyword: '' });
  assert.equal(qService, '{project="blog-cms",service="app"}');

  const q5xx = buildLogQL({ service: 'nginx', errorGroup: '5xx', keyword: 'fail' });
  assert.ok(q5xx.includes('{project="blog-cms",service="nginx"}'));
  assert.ok(q5xx.includes('| json | __error__="" | status >= 500'));
  assert.ok(q5xx.includes('|= "fail"'));

  const qKeywordEscape = buildLogQL({ service: 'app', errorGroup: '', keyword: 'test "quote" \\slash' });
  assert.ok(qKeywordEscape.includes('|= "test \\"quote\\" \\\\slash"'));
});

test('parseLokiStreams: Định dạng thời gian theo giờ Việt Nam, sắp xếp mới nhất trước, bóc tách JSON an toàn', () => {
  const mockStreams = [
    {
      stream: { service: 'nginx', stream: 'stdout' },
      values: [
        ['1700000000000000000', '{"method":"GET","path":"/test","status":200}\n']
      ]
    },
    {
      stream: { service: 'app', stream: 'stderr' },
      values: [
        ['1700000005000000000', 'Lỗi database: ECONNREFUSED\n']
      ]
    }
  ];

  const entries = parseLokiStreams(mockStreams);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].service, 'app');
  assert.equal(entries[0].rawLine, 'Lỗi database: ECONNREFUSED');
  assert.equal(entries[1].service, 'nginx');
  assert.equal(entries[1].parsedJson?.status, 200);
  assert.ok(typeof entries[0].timeFormatted === 'string');
});

test('technicalLogService.fetchLogs: Xử lý thành công dữ liệu từ Loki mock server', async (t) => {
  const app = express();
  app.get('/loki/api/v1/query_range', (req, res) => {
    assert.ok(req.query.query.includes('project="blog-cms"'));
    res.json({
      status: 'success',
      data: {
        resultType: 'streams',
        result: [
          {
            stream: { service: 'app', stream: 'stdout' },
            values: [['1700000000000000000', 'Application started']]
          }
        ]
      }
    });
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));

  const service = createTechnicalLogService({
    lokiUrl: `http://127.0.0.1:${server.address().port}`
  });

  const result = await service.fetchLogs({ service: 'app' });
  assert.equal(result.success, true);
  assert.equal(result.status, 200);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].rawLine, 'Application started');
});

test('technicalLogService.fetchLogs: Xử lý lỗi kết nối Loki (504/timeout/down) rõ ràng', async () => {
  const service = createTechnicalLogService({
    lokiUrl: 'http://127.0.0.1:54321', // Unused port
    timeoutMs: 1000
  });

  const result = await service.fetchLogs();
  assert.equal(result.success, false);
  assert.equal(result.status, 502);
  assert.ok(result.message.includes('Không thể đọc') || result.message.includes('Hết thời gian'));
  assert.deepEqual(result.entries, []);
});

test('Phân quyền /admin/system-logs: ADMIN được vào, AUTHOR/READER/Khách bị từ chối', async (t) => {
  const { load } = require('./helpers/load-module');
  let currentUser = null;
  let calls = 0;
  const auth = load('src/middlewares/auth.js', {
    '../repositories/user-repository': { findById: async () => currentUser }
  });
  const service = createTechnicalLogService();
  service.fetchLogs = async () => {
    calls++;
    return { success: true, status: 200, entries: [], params: sanitizeParams({}) };
  };
  const routes = load('src/routes/technical-log-routes.js', {
    '../middlewares/auth': auth,
    '../controllers/technical-log-controller': createTechnicalLogController(service)
  });
  const app = express();
  app.use((req, res, next) => {
    req.session = currentUser ? { userId: currentUser.id, authVersion: 0 } : null;
    next();
  });
  app.set('view engine', 'ejs');
  app.set('views', require('node:path').resolve(__dirname, '../views'));

  app.use(routes);

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));

  const base = `http://127.0.0.1:${server.address().port}/admin/system-logs`;

  currentUser = null;
  const guestRes = await fetch(base, { redirect: 'manual' });
  assert.equal(guestRes.status, 303);
  assert.ok(guestRes.headers.get('location').includes('/login'));

  currentUser = { id: 10, role: 'READER', status: 'ACTIVE', session_version: 0 };
  const readerRes = await fetch(base);
  assert.equal(readerRes.status, 403);

  currentUser = { id: 4, role: 'AUTHOR', status: 'ACTIVE', session_version: 0 };
  const authorRes = await fetch(base);
  assert.equal(authorRes.status, 403);
  assert.equal(calls, 0);
  currentUser = { id: 3, name: 'Admin', role: 'ADMIN', status: 'ACTIVE', session_version: 0 };
  const adminRes = await fetch(base);
  assert.equal(adminRes.status, 200);
  assert.equal(adminRes.headers.get('cache-control'), 'no-store');
  assert.equal(calls, 1);
});

test('Trang system-logs escape nội dung log chứa mã HTML/XSS nguy hiểm', async () => {
  const ejs = require('ejs');
  const fs = require('node:fs');
  const path = require('node:path');

  const dangerousLog = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const templatePath = path.resolve(__dirname, '../views/admin/system-logs.ejs');
  const html = ejs.render(fs.readFileSync(templatePath, 'utf8'), {
    user: { name: 'Admin', role: 'ADMIN' },
    currentUser: { name: 'Admin', role: 'ADMIN' },
    currentPath: '/admin/system-logs',
    unreadCount: 0,
    feedback: null,
    total: 1,
    logs: [
      {
        timestamp: '1700000000000000000',
        timeFormatted: '21/10/2026, 12:00:00',
        service: 'app',
        streamType: 'stderr',
        rawLine: dangerousLog,
        parsedJson: null
      }
    ],
    params: { service: 'app', interval: '1h', errorGroup: '', keyword: '', limit: 100 },
    error: null,
    allowedServices: ['app', 'nginx', 'mysql', 'phpmyadmin'],
    allowedIntervals: ['15m', '1h', '6h', '24h', '7d'],
    allowedErrorGroups: ['', 'all', '5xx', '4xx', 'db_error', 'connection']
  }, { filename: templatePath });

  assert.ok(!html.includes('<script>alert("xss")</script>'));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('&lt;script&gt;alert('));
});

test('Loki: deadline bao gồm body chậm sau HTTP headers', async (t) => {
  const server = require('node:http').createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const service = createTechnicalLogService({ lokiUrl: `http://127.0.0.1:${server.address().port}`, timeoutMs: 100 });
  const result = await service.fetchLogs();
  assert.equal(result.status, 504);
  assert.equal(result.success, false);
});

test('Loki: từ chối JSON sai schema, body quá lớn và không chuyển lỗi nội bộ ra UI', async (t) => {
  let body = JSON.stringify({ status: 'error', error: 'private detail' });
  let status = 200;
  const server = require('node:http').createServer((req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const service = createTechnicalLogService({ lokiUrl: `http://127.0.0.1:${server.address().port}` });
  for (const variant of ['schema', 'size', 'http']) {
    if (variant === 'size') body = 'x'.repeat(2 * 1024 * 1024 + 1);
    if (variant === 'http') { status = 500; body = 'private detail'; }
    const result = await service.fetchLogs();
    assert.equal(result.status, 502, variant);
    assert.equal(result.success, false);
    assert.doesNotMatch(result.message, /private detail/);
  }
});

test('Controller giữ mã lỗi Loki và render thông báo thay vì HTTP 200', async () => {
  const service = createTechnicalLogService();
  service.fetchLogs = async () => ({ success: false, status: 504, entries: [], params: sanitizeParams({}), message: 'Timeout' });
  const res = { set() {}, status(code) { this.code = code; return this; }, render(view, data) { this.data = data; } };
  await createTechnicalLogController(service).showLogs({ query: {}, user: { role: 'ADMIN' } }, res);
  assert.equal(res.code, 504);
  assert.equal(res.data.error, 'Timeout');
});

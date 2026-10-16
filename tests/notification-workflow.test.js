const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-module');
const admin = { id: 3, role: 'ADMIN', email_verified_at: new Date() };
function fixture({ status = 'PENDING', postStatus = 'PUBLISHED', parent = null, parentId = null, content = 'Cũ' } = {}) {
  const calls = [], notices = [];
  const c = { async execute(sql, values) {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT post_id')) return [[{ post_id: 5 }]];
    if (sql.includes('FROM posts WHERE id=? FOR UPDATE')) return [[{ id: 5, author_id: 4, title: 'Bài thử', status: postStatus }]];
    if (sql.startsWith('SELECT id,user_id,parent_id')) return [[{ id: 7, user_id: 9, status, parent_id: parentId, is_deleted: 0, content }]];
    if (sql.startsWith('SELECT user_id,status,is_deleted')) return [[...(parent ? [parent] : [])]];
    return [{ affectedRows: 1 }];
  } };
  const service = load('src/services/community-service.js', {
    '../config/database': c,
    './activity-service': { withActor: async (actor, roles, action) => action(c, actor), record: async () => {}, notify: async (_, ...args) => notices.push(args) }
  });
  return { service, calls, notices };
}
test('ADMIN có thể xem bình luận công khai thay vì quay lại mục quản lý', async () => {
  const row = { id: 7, parent_id: null, status: 'APPROVED', post_status: 'PUBLISHED', slug: 'bai-thu', is_deleted: 0 };
  const service = load('src/services/community-service.js', { '../config/database': { execute: async () => [[row]] }, './activity-service': {} });
  assert.equal((await service.commentDestination('7', admin)).path, '/admin/comments?comment=7#comment-7');
  assert.equal((await service.commentDestination('7', admin, true)).path, '/posts/bai-thu/comments/7?page=1#comment-7');
});
test('Mở thông báo kiểm tra chủ sở hữu, đánh dấu đã đọc và giữ đúng đích', async () => {
  const calls = [];
  const db = { async execute(sql, values) { calls.push({ sql, values }); return sql.startsWith('SELECT') ? [[{ target_path: '/comments/7/go' }]] : [{ affectedRows: 1 }]; } };
  const service = load('src/services/community-service.js', { '../config/database': db, './activity-service': {} });
  assert.equal((await service.openNotification(admin, '11')).path, '/comments/7/go');
  for (const c of calls) { assert.match(c.sql, /id=\? AND user_id=\?/); assert.equal(c.values[1], admin.id); }
  assert.match(calls[1].sql, /COALESCE/);
});
test('Không đọc hoặc mở thông báo người khác, không chuyển hướng ra ngoài', async () => {
  for (const target of [null, 'https://evil.invalid', '//evil.invalid', '/\\evil.invalid']) {
    const calls = [];
    const service = load('src/services/community-service.js', { '../config/database': { async execute(sql) { calls.push(sql); return [[...(target ? [{ target_path: target }] : [])]]; } }, './activity-service': {} });
    const result = await service.openNotification(admin, '11');
    assert.equal(result.success, false);
    assert.equal(calls.length, 1);
  }
});
test('Duyệt xong đánh dấu thông báo kiểm duyệt cũ đã xử lý, không gửi lại khi bấm lặp', async () => {
  const f = fixture();
  assert.equal((await f.service.mutate(admin, 'moderate', '7', { status: 'APPROVED' })).success, true);
  assert.ok(f.calls.some(c => c.sql.includes('UPDATE notifications n JOIN users') && c.sql.includes("u.role='ADMIN'") && c.values[0] === 7));
  assert.equal(f.notices.length, 2);
  const same = fixture({ status: 'APPROVED' });
  await same.service.mutate(admin, 'moderate', '7', { status: 'APPROVED' });
  assert.equal(same.notices.length, 0);
  assert.ok(!same.calls.some(c => c.sql.startsWith('UPDATE')));
});
test('Không báo đã duyệt hiển thị khi bài đang nháp hoặc bình luận gốc bị ẩn/xóa', async () => {
  for (const options of [{ postStatus: 'DRAFT' }, { parentId: 6, parent: { user_id: 4, status: 'HIDDEN', is_deleted: 0 } }, { parentId: 6, parent: { user_id: 4, status: 'APPROVED', is_deleted: 1 } }]) {
    const f = fixture(options);
    assert.equal((await f.service.mutate(admin, 'moderate', '7', { status: 'APPROVED' })).status, 409);
    assert.equal(f.notices.length, 0);
    assert.ok(!f.calls.some(c => c.sql.startsWith('UPDATE')));
  }
});
test('Ẩn bình luận báo người gửi; lưu nội dung không đổi không gửi thông báo mới', async () => {
  const hidden = fixture({ status: 'APPROVED' });
  await hidden.service.mutate(admin, 'moderate', '7', { status: 'HIDDEN' });
  assert.equal(hidden.notices[0][0], 9);
  assert.match(hidden.notices[0][1], /đã bị ẩn/);
  const same = fixture({ content: 'Không đổi' });
  await same.service.mutate({ ...admin, id: 9, role: 'READER' }, 'edit', '7', { content: 'Không đổi' });
  assert.equal(same.notices.length, 0);
  assert.ok(!same.calls.some(c => c.sql.startsWith('UPDATE')));
});
test('Thông báo cũ giữ nội dung sự kiện nhưng hiển thị trạng thái bình luận hiện tại', async () => {
  const db = { async execute(sql) {
    if (sql.includes('COUNT(*)')) return [[{ total: 1 }]];
    if (sql.startsWith('SELECT n.id')) return [[{ id: 11, message: 'Có bình luận chờ duyệt', comment_id: 7 }]];
    return [[{ content: 'Đã sửa', status: 'APPROVED', is_deleted: 0, post_status: 'PUBLISHED', root_status: null }]];
  } };
  const service = load('src/services/community-service.js', { '../config/database': db, './activity-service': {} });
  const result = await service.notifications(admin, {});
  assert.equal(result.rows[0].commentState, 'Đang hiển thị');
  assert.equal(result.rows[0].preview, 'Đã sửa');
});

test('Nút mở thông báo đi qua POST và CSRF trước khi đánh dấu đã đọc', async () => {
  const express = require('express');
  let opened = 0;
  const controller = load('src/controllers/community-controller.js', { '../services/community-service': { async openNotification() { opened++; return { success: true, path: '/comments/7/go' }; } } });
  const router = load('src/routes/community-routes.js', {
    '../controllers/community-controller': controller,
    '../middlewares/auth': { requireAuth(req, res, next) { req.user = admin; next(); }, requireRole: () => (req, res, next) => next(), requireVerified(req, res, next) { next(); } }
  });
  const app = express();
  app.use((req, res, next) => { req.session = { csrfToken: 'a'.repeat(64) }; next(); });
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/notifications/11/open';
    const denied = await fetch(url, { method: 'POST', redirect: 'manual' });
    assert.equal(denied.status, 403);
    await denied.text();
    assert.equal(opened, 0);
    const allowed = await fetch(url, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ _csrf: 'a'.repeat(64) }) });
    assert.equal(allowed.status, 303);
    assert.equal(allowed.headers.get('location'), '/comments/7/go');
    await allowed.text();
    assert.equal(opened, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

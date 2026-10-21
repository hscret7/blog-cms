const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load-module');

function database(execute) {
  const state = { commits: 0, rollbacks: 0, writes: [] };
  const c = {
    beginTransaction: async () => {},
    commit: async () => { state.commits++; },
    rollback: async () => { state.rollbacks++; },
    release() {},
    async execute(sql, values = []) {
      if (/^(UPDATE|INSERT|DELETE)/.test(sql)) state.writes.push({ sql, values });
      return execute(sql, values);
    }
  };
  return { state, c, db: { execute: c.execute, getConnection: async () => c } };
}
const actor = { id: 3, role: 'ADMIN', status: 'ACTIVE', session_version: 0 };

test('Phiên bị thu hồi sau middleware không được ghi bài/bình luận trong transaction', async () => {
  const f = database(async () => [[{ ...actor, session_version: 1 }]]);
  const service = load('src/services/activity-service.js', { '../config/database': f.db });
  let called = false;
  await assert.rejects(() => service.withActor(actor, ['ADMIN'], async () => { called = true; }), e => e.status === 403);
  assert.equal(called, false);
  assert.equal(f.state.commits, 0);
  assert.equal(f.state.rollbacks, 1);
});

test('ADMIN có phiên cũ không tạo tài khoản dù vai trò/trạng thái vẫn hợp lệ', async () => {
  const f = database(async () => [{ affectedRows: 1 }]);
  let created = false;
  const service = load('src/services/admin-user-service.js', {
    '../config/database': f.db,
    '../repositories/admin-user-repository': {
      lockUsersForAdministration: async () => [{ ...actor, session_version: 1 }],
      create: async () => { created = true; return 8; }
    },
    './password-service': { hashPassword: async () => 'hash' },
    './activity-service': { record: async () => {} }
  });
  const result = await service.createUser({ name: 'Test', email: 'test@example.invalid', role: 'READER', password: 'Test123!', password_confirmation: 'Test123!' }, actor);
  assert.equal(result.status, 403);
  assert.equal(created, false);
  assert.equal(f.state.commits, 0);
});

test('Phiên cũ không gỡ ảnh hoặc xóa bài sau khi đã qua kiểm tra truy cập', async () => {
  for (const operation of ['removeCover', 'deletePostWithCover']) {
    const f = database(async () => [[{ ...actor, session_version: 1 }]]);
    let changed = false;
    const service = load('src/services/post-cover-service.js', {
      '../config/database': f.db,
      '../repositories/post-repository': {
        findByIdForUser: async () => ({ id: 5 }),
        lockByIdForUser: async () => { changed = true; return { id: 5, cover_path: null }; },
        updateCover: async () => {}, remove: async () => 1
      },
      './cover-storage': { coverStorage: { remove: async () => {}, resolvePath() {} } },
      './activity-service': { record: async () => {} }
    });
    assert.equal((await service[operation]('5', actor)).status, 403);
    assert.equal(changed, false);
    assert.equal(f.state.commits, 0);
  }
});

test('Phiên cũ không đổi tên hoặc mật khẩu sau khi tài khoản bị thu hồi phiên', async () => {
  for (const operation of ['updateProfile', 'changePassword']) {
    const f = database(async sql => sql.startsWith('SELECT')
      ? [[{ email: 'test@example.invalid', password_hash: 'same-hash', session_version: 1 }]]
      : [{ affectedRows: 1 }]);
    const { createAccountService } = load('src/services/account-service.js', { '../config/database': {}, './mail-service': { mailService: {} } });
    const service = createAccountService({ db: f.db, mail: {}, verifyPassword: async () => true, hashPassword: async () => 'new-hash' });
    const result = await service[operation](actor, { name: 'New name', email: 'test@example.invalid', password: 'Test123!', password_confirmation: 'Test123!', current_password: 'old' });
    assert.equal(result.status, 409);
    assert.equal(f.state.writes.length, 0);
    assert.equal(f.state.commits, 0);
  }
});

test('Tìm thông báo lọc cả danh sách và tổng số; wildcard được coi là văn bản', async () => {
  const calls = [];
  const db = { async execute(sql, values) { calls.push({ sql, values }); return sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]]; } };
  const service = load('src/services/community-service.js', { '../config/database': db, './activity-service': {} });
  const result = await service.notifications(actor, { q: "100%_!'", page: '1' });
  assert.equal(result.total, 0);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.sql, /n.message LIKE \? ESCAPE '!'/);
    assert.equal(call.values[1], "%100!%!_!!'%");
    assert.equal(call.values[0], actor.id);
    assert.ok(!call.sql.includes('100%'));
  }
});

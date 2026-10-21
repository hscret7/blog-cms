const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('./helpers/load-module');
const passwords = require('../src/services/password-service');
const { createAccountService, tokenHash } = load('src/services/account-service.js', {
  '../config/database': {}, './mail-service': { mailService: {} }
});
const input = { name: 'Độc giả', email: 'reader@example.invalid', password: 'Mat khau kiem thu 2026!', password_confirmation: 'Mat khau kiem thu 2026!', role: 'ADMIN' };
function fixture() {
  const state = { token: null, used: false, active: true, expired: false, calls: [], sent: [], commits: 0, rollbacks: 0 };
  const c = {
    async beginTransaction() {}, async commit() { state.commits++; }, async rollback() { state.rollbacks++; }, release() {},
    async execute(sql, values = []) {
      state.calls.push({ sql, values });
      if (sql.startsWith('INSERT INTO users')) return [{ insertId: 11 }];
      if (sql.startsWith('INSERT INTO account_tokens')) { state.token = values[2]; return [{ insertId: 12 }]; }
      if (sql.startsWith('SELECT user_id FROM account_tokens')) return [[...(values[0] === state.token ? [{ user_id: 11 }] : [])]];
      if (sql.startsWith('SELECT id FROM users')) return [[...(state.active ? [{ id: 11 }] : [])]];
      if (sql.startsWith('SELECT id FROM account_tokens')) return [[...(!state.used && !state.expired && values[0] === state.token ? [{ id: 12 }] : [])]];
      if (sql.startsWith('SELECT id,email FROM users')) return [[{ id:11,email:input.email }]];
      if (sql.includes('WHERE id = ?') && sql.startsWith('UPDATE account_tokens')) state.used = true;
      return [{ affectedRows: 1 }];
    }
  };
  const db = { getConnection: async () => c, execute: c.execute };
  const mail = { assertConfigured() {}, async sendToken(email, purpose, raw) { state.sent.push({ email, purpose, raw }); } };
  return { state, db, mail, service: createAccountService({ db, mail, hashPassword: async () => 'TEST_HASH' }) };
}
test('Đăng ký công khai cố định READER và chỉ lưu hash của token', async () => {
  const { state, service } = fixture();
  assert.equal((await service.register(input)).success, true);
  const insert = state.calls.find(c => c.sql.startsWith('INSERT INTO users'));
  assert.match(insert.sql, /'READER'/);
  assert.ok(!insert.values.includes('ADMIN'));
  assert.ok(!insert.values.includes(input.password));
  const raw = state.sent[0].raw;
  assert.equal(raw.length, 64);
  assert.equal(state.token, tokenHash(raw));
  assert.ok(!state.calls.some(c => c.values.includes(raw)));
  assert.equal(state.commits, 1);
});
test('Xác minh token chỉ thành công một lần; replay rollback', async () => {
  const { state, service } = fixture();
  await service.register(input);
  assert.equal((await service.consume(state.sent[0].raw, 'VERIFY_EMAIL')).success, true);
  assert.equal((await service.consume(state.sent[0].raw, 'VERIFY_EMAIL')).status, 400);
  assert.equal(state.rollbacks, 1);
});
test('Token hết hạn, tài khoản khóa hoặc token sai không xác minh được', async () => {
  for (const flag of ['expired','active']) {
    const { state, service } = fixture(); await service.register(input);
    state[flag] = flag === 'expired';
    const before = state.calls.length;
    assert.equal((await service.consume(state.sent[0].raw, 'VERIFY_EMAIL')).status, 400);
    assert.ok(!state.calls.slice(before).some(c => c.sql.startsWith('UPDATE users')));
  }
  const { service } = fixture();
  for (const token of ['', null, [], 'a'.repeat(63), 'G'.repeat(64)]) assert.equal((await service.consume(token,'VERIFY_EMAIL')).status,400);
});
test('Đặt lại mật khẩu tăng phiên bản phiên, vô hiệu hóa token và không lưu mật khẩu thô', async () => {
  const { state, service } = fixture();
  await service.requestReset(input.email);
  const result = await service.consume(state.sent[0].raw,'RESET_PASSWORD',input);
  assert.equal(result.success,true);
  assert.ok(state.calls.some(c => /session_version = session_version \+ 1/.test(c.sql)));
  assert.ok(!state.calls.some(c => c.values.includes(input.password)));
});
test('SMTP chưa cấu hình không tạo tài khoản dở dang', async () => {
  const { state, db } = fixture();
  const service = createAccountService({ db, mail: { assertConfigured() { throw new Error('Not configured'); } } });
  await assert.rejects(() => service.register(input));
  assert.equal(state.calls.length,0);
});
test('Gửi thư thất bại sau commit báo đúng tài khoản đã tạo, không để lộ token', async () => {
  const { state, db, mail } = fixture(); mail.sendToken = async () => { throw Object.assign(new Error('hidden'),{code:'TEST_MAIL'}); };
  const service = createAccountService({ db, mail, hashPassword: async () => 'TEST_HASH' });
  const result = await service.register(input);
  assert.equal(result.status,503);
  assert.match(result.message,/Tài khoản đã được tạo/);
  assert.ok(!JSON.stringify(result).includes(state.token));
  assert.equal(state.commits,1);
});
test('Thông báo khôi phục không phân biệt email tồn tại hay không', async () => {
  const a = fixture(), b = fixture();
  b.db.getConnection = async () => ({ beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},execute:async()=>[[]] });
  assert.equal((await a.service.requestReset(input.email)).message, (await b.service.requestReset('unknown@example.invalid')).message);
});
test('Mật khẩu không khớp không tiêu thụ token', async () => {
  const { state,service } = fixture();await service.requestReset(input.email);
  assert.equal((await service.consume(state.sent[0].raw,'RESET_PASSWORD',{...input,password_confirmation:'wrong'})).status,422);
  assert.equal(state.used,false);
});
test('Argon2id băm và kiểm tra mật khẩu Unicode', async () => {
  const raw='Mật khẩu thử nghiệm 2026!'; const hash = await passwords.hashPassword(raw);
  assert.match(hash,/^\$argon2id\$/);
  assert.equal(await passwords.verifyPassword(hash,raw),true);
  assert.equal(await passwords.verifyPassword(hash,'incorrect password'),false);
});

test('Chọn muốn làm tác giả chỉ tạo yêu cầu, không nhận AUTHOR khi đăng ký',async()=>{
 const f=fixture();const result=await f.service.register({...input,interest:'author_request',author_reason:'Viết về công nghệ'});assert.equal(result.success,true);
 const insert=f.state.calls.find(c=>c.sql.startsWith('INSERT INTO users'));assert.match(insert.sql,/'READER'/);assert.ok(f.state.calls.some(c=>c.sql.startsWith('INSERT INTO author_requests')));
 const invalid=fixture();assert.equal((await invalid.service.register({...input,interest:'ADMIN'})).status,422);assert.equal(invalid.state.calls.length,0);
});

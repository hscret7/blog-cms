const { randomBytes, createHash } = require('node:crypto');
const pool = require('../config/database');
const passwords = require('./password-service');
const { mailService } = require('./mail-service');
const { validateUserInput } = require('../validators/user-validator');

function tokenHash(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return null;
  return createHash('sha256').update(value).digest('hex');
}
const fail = (status, message, errors = {}) => ({ success: false, status, message, errors });
function createAccountService({ db = pool, mail = mailService, hashPassword = passwords.hashPassword, verifyPassword = passwords.verifyPassword } = {}) {
  async function transaction(action) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const result = await action(connection);
      if (result.success) await connection.commit(); else await connection.rollback();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
  async function audit(c, userId, action) {
    await c.execute('INSERT INTO audit_events(actor_id,action,object_type,object_id) VALUES (?, ?, ?, ?)', [userId, action, 'user', userId]);
  }
  async function issue(connection, user, purpose) {
    const raw = randomBytes(32).toString('hex');
    await connection.execute('UPDATE account_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [user.id, purpose]);
    await connection.execute(`INSERT INTO account_tokens(user_id,purpose,token_hash,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`, [user.id, purpose, tokenHash(raw), purpose === 'VERIFY_EMAIL' ? 1440 : 30]);
    return raw;
  }
  async function register(input) {
    const validation = validateUserInput({ ...input, role: 'READER' }, { creating: true });
    if (!validation.isValid) return fail(422, 'Vui lòng kiểm tra thông tin đăng ký.', validation.errors);
    mail.assertConfigured();
    const hash = await hashPassword(input.password);
    let result;
    try {
      result = await transaction(async c => {
        const [insert] = await c.execute("INSERT INTO users(name,email,password_hash,role,status) VALUES (?,?,?,'READER','ACTIVE')", [validation.data.name, validation.data.email, hash]);
        const raw = await issue(c, { id: insert.insertId }, 'VERIFY_EMAIL');
        await audit(c, insert.insertId, 'ACCOUNT_REGISTER');
        return { success: true, raw };
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return fail(409, 'Không thể đăng ký bằng email này. Nếu đã có tài khoản, hãy đăng nhập hoặc khôi phục mật khẩu.');
      throw error;
    }
    try { await mail.sendToken(validation.data.email, 'VERIFY_EMAIL', result.raw); }
    catch (error) {
      console.error('Gửi email xác minh thất bại:', error.code || 'MAIL_FAILED');
      return fail(503, 'Tài khoản đã được tạo nhưng chưa gửi được email. Hãy đăng nhập rồi bấm Gửi lại email xác minh.');
    }
    return { success: true, message: 'Đã tạo tài khoản độc giả. Kiểm tra email để xác minh tài khoản.' };
  }
  async function requestReset(email) {
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return fail(422, 'Nhập email hợp lệ.');
    mail.assertConfigured();
    const result = await transaction(async c => {
      const [rows] = await c.execute("SELECT id,email FROM users WHERE email = ? AND status = 'ACTIVE' FOR UPDATE", [email.trim().toLowerCase()]);
      if (!rows.length) return { success: true };
      return { success: true, email: rows[0].email, raw: await issue(c, rows[0], 'RESET_PASSWORD') };
    });
    if (result.raw) {
      try { await mail.sendToken(result.email, 'RESET_PASSWORD', result.raw); }
      catch (error) { console.error('Gửi email khôi phục thất bại:', error.code || 'MAIL_FAILED'); }
    }
    return { success: true, message: 'Nếu email thuộc tài khoản đang hoạt động, bạn sẽ nhận được liên kết đặt lại mật khẩu. Có thể thử lại sau nếu chưa nhận được.' };
  }
  async function resend(userId) {
    mail.assertConfigured();
    const result = await transaction(async c => {
      const [rows] = await c.execute("SELECT id,email,email_verified_at FROM users WHERE id = ? AND status = 'ACTIVE' FOR UPDATE", [userId]);
      if (!rows.length) return fail(403, 'Tài khoản không hoạt động.');
      if (rows[0].email_verified_at) return { success: true };
      return { success: true, email: rows[0].email, raw: await issue(c, rows[0], 'VERIFY_EMAIL') };
    });
    if (result.raw) await mail.sendToken(result.email, 'VERIFY_EMAIL', result.raw);
    return { success: true, message: 'Đã xử lý yêu cầu xác minh. Kiểm tra hộp thư của bạn.' };
  }
  async function consume(raw, purpose, input = {}) {
    if (!['VERIFY_EMAIL', 'RESET_PASSWORD'].includes(purpose)) return fail(400, 'Mục đích liên kết không hợp lệ.');
    const digest = tokenHash(raw);
    if (!digest) return fail(400, 'Liên kết không hợp lệ hoặc đã hết hạn.');
    let hash;
    if (purpose === 'RESET_PASSWORD') {
      try { passwords.validatePassword(input.password); } catch (error) { return fail(422, error.message); }
      if (input.password_confirmation !== input.password) return fail(422, 'Hai lần nhập mật khẩu không khớp.');
      hash = await hashPassword(input.password);
    }
    return transaction(async c => {
      // Tìm user trước, luôn khóa user -> token để cùng thứ tự với issue().
      const [candidates] = await c.execute('SELECT user_id FROM account_tokens WHERE token_hash = ? AND purpose = ?', [digest, purpose]);
      if (!candidates.length) return fail(400, 'Liên kết không hợp lệ hoặc đã hết hạn.');
      const [users] = await c.execute("SELECT id FROM users WHERE id = ? AND status = 'ACTIVE' FOR UPDATE", [candidates[0].user_id]);
      if (!users.length) return fail(400, 'Liên kết không hợp lệ hoặc đã hết hạn.');
      const [tokens] = await c.execute('SELECT id FROM account_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE', [digest, purpose]);
      if (!tokens.length) return fail(400, 'Liên kết không hợp lệ hoặc đã hết hạn.');
      await c.execute('UPDATE account_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [tokens[0].id]);
      if (purpose === 'VERIFY_EMAIL') await c.execute('UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ?', [users[0].id]);
      else {
        await c.execute('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', [hash, users[0].id]);
        await c.execute('UPDATE account_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [users[0].id, purpose]);
      }
      await audit(c, users[0].id, purpose === 'VERIFY_EMAIL' ? 'EMAIL_VERIFY' : 'PASSWORD_RESET');
      return { success: true, message: purpose === 'VERIFY_EMAIL' ? 'Email đã được xác minh.' : 'Mật khẩu đã thay đổi. Hãy đăng nhập lại.' };
    });
  }
  async function updateProfile(actor, input) {
    const v = validateUserInput({ name: input?.name, email: input?.email, role: actor.role });
    if (!v.isValid) return fail(422, 'Thông tin cá nhân không hợp lệ.', v.errors);
    const [users] = await db.execute('SELECT email,password_hash FROM users WHERE id = ?', [actor.id]);
    if (!users[0]) return fail(403, 'Tài khoản không hoạt động.');
    const emailChanged = v.data.email !== users[0].email;
    if (emailChanged) {
      mail.assertConfigured();
      if (!await verifyPassword(users[0].password_hash, input.current_password)) return fail(422, 'Nhập đúng mật khẩu hiện tại để thay đổi email.');
    }
    let result;
    try {
      result = await transaction(async c => {
        const [current] = await c.execute("SELECT email,password_hash FROM users WHERE id = ? AND status = 'ACTIVE' FOR UPDATE", [actor.id]);
        if (!current[0] || current[0].email !== users[0].email || current[0].password_hash !== users[0].password_hash) return fail(409, 'Tài khoản đã thay đổi. Vui lòng tải lại trang.');
        await c.execute('UPDATE users SET name = ? WHERE id = ?', [v.data.name, actor.id]);
        let raw;
        if (emailChanged) {
          await c.execute('UPDATE users SET email = ?, email_verified_at = NULL, session_version = session_version + 1 WHERE id = ?', [v.data.email, actor.id]);
          await c.execute('UPDATE account_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL', [actor.id]);
          raw = await issue(c, actor, 'VERIFY_EMAIL');
        }
        await audit(c, actor.id, 'PROFILE_UPDATE');
        return { success: true, raw, emailChanged };
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return fail(409, 'Email này đã được sử dụng.');
      throw error;
    }
    if (result.raw) {
      try { await mail.sendToken(v.data.email, 'VERIFY_EMAIL', result.raw); }
      catch (error) { console.error('Gửi xác minh email mới thất bại:', error.code || 'MAIL_FAILED'); return fail(503, 'Email đã thay đổi nhưng gửi thư thất bại. Đăng nhập bằng email mới và gửi lại xác minh.'); }
    }
    return result.success ? { success: true, emailChanged, message: emailChanged ? 'Đã đổi email. Đăng nhập lại bằng email mới rồi xác minh hộp thư.' : 'Đã cập nhật thông tin.' } : result;
  }
  async function changePassword(actor, input) {
    try { passwords.validatePassword(input?.password); } catch (error) { return fail(422, error.message); }
    if (input.password_confirmation !== input.password) return fail(422, 'Hai lần nhập mật khẩu không khớp.');
    const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [actor.id]);
    if (!rows[0] || !await verifyPassword(rows[0].password_hash, input.current_password)) return fail(422, 'Mật khẩu hiện tại không đúng.');
    const hash = await hashPassword(input.password);
    return transaction(async c => {
      const [current] = await c.execute("SELECT password_hash FROM users WHERE id = ? AND status = 'ACTIVE' FOR UPDATE", [actor.id]);
      if (!current[0] || current[0].password_hash !== rows[0].password_hash) return fail(409, 'Tài khoản đã thay đổi. Vui lòng đăng nhập lại.');
      await c.execute('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', [hash, actor.id]);
      await c.execute("UPDATE account_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = 'RESET_PASSWORD' AND used_at IS NULL", [actor.id]);
      await audit(c, actor.id, 'PASSWORD_CHANGE');
      return { success: true, message: 'Đã đổi mật khẩu. Hãy đăng nhập lại.' };
    });
  }
  return { register, requestReset, resend, consume, updateProfile, changePassword };
}
module.exports = { createAccountService, tokenHash, ...createAccountService() };

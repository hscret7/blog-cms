const pool = require('../config/database');

async function findAll() {
  const [rows] = await pool.execute(
    `SELECT id, name, email, role, status, created_at, updated_at
     FROM users
     ORDER BY id DESC`
  );

  return rows;
}

async function findById(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, name, email, role, status, created_at, updated_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function create(data, passwordHash, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO users (name, email, password_hash, role, status, email_verified_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', UTC_TIMESTAMP())`,
    [data.name, data.email, passwordHash, data.role]
  );

  return result.insertId;
}

async function update(id, data, executor = pool) {
  await executor.execute(
    `UPDATE account_tokens t JOIN users u ON u.id = t.user_id
     SET t.used_at = UTC_TIMESTAMP() WHERE u.id = ? AND u.email <> ? AND t.used_at IS NULL`,
    [id, data.email]
  );
  const [result] = await executor.execute(
    `UPDATE users
     SET name = ?, email_verified_at = IF(email = ?, email_verified_at, NULL), session_version = session_version + IF(email = ?, 0, 1), email = ?, role = ?
     WHERE id = ?`,
    [data.name, data.email, data.email, data.email, data.role, id]
  );

  return result.affectedRows;
}

async function setStatus(id, status, executor = pool) {
  if (!['ACTIVE', 'LOCKED'].includes(status)) {
    throw new Error('Trạng thái người dùng không hợp lệ.');
  }

  const [result] = await executor.execute(
    `UPDATE users
     SET status = ?
     WHERE id = ?`,
    [status, id]
  );

  return result.affectedRows;
}

async function lockUsersForAdministration(connection) {
  const [rows] = await connection.execute(
    `SELECT id, role, status
     FROM users
     ORDER BY id
     FOR UPDATE`
  );

  return rows;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  setStatus,
  lockUsersForAdministration
};
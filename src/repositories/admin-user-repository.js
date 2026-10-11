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
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, 'ACTIVE')`,
    [data.name, data.email, passwordHash, data.role]
  );

  return result.insertId;
}

async function update(id, data, executor = pool) {
  const [result] = await executor.execute(
    `UPDATE users
     SET name = ?, email = ?, role = ?
     WHERE id = ?`,
    [data.name, data.email, data.role, id]
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
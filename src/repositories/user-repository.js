const pool = require('../config/database');

async function findByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT
       id,
       name,
       email,
       password_hash,
       role,
       status
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT
       id,
       name,
       email,
       role,
       status
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

module.exports = {
  findByEmail,
  findById
};
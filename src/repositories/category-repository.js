const pool = require('../config/database');

async function findAll() {
  const [rows] = await pool.execute(
    `SELECT
       id,
       name,
       slug,
       description,
       created_at,
       updated_at
     FROM categories
     ORDER BY id DESC`
  );

  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT
       id,
       name,
       slug,
       description,
       created_at,
       updated_at
     FROM categories
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function findBySlug(slug) {
  const [rows] = await pool.execute(
    `SELECT
       id,
       name,
       slug,
       description,
       created_at,
       updated_at
     FROM categories
     WHERE slug = ?
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

async function create({ name, slug, description }) {
  const [result] = await pool.execute(
    `INSERT INTO categories (name, slug, description)
     VALUES (?, ?, ?)`,
    [name, slug, description]
  );

  return result.insertId;
}

async function update(id, { name, slug, description }) {
  const [result] = await pool.execute(
    `UPDATE categories
     SET name = ?, slug = ?, description = ?
     WHERE id = ?`,
    [name, slug, description, id]
  );

  return result.affectedRows;
}

async function remove(id) {
  const [result] = await pool.execute(
    `DELETE FROM categories
     WHERE id = ?`,
    [id]
  );

  return result.affectedRows;
}

module.exports = {
  findAll,
  findById,
  findBySlug,
  create,
  update,
  remove
};

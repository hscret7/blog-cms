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

async function findById(id, executor = pool) {
  const [rows] = await executor.execute(
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

async function create({ name, slug, description }, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO categories (name, slug, description)
     VALUES (?, ?, ?)`,
    [name, slug, description]
  );

  return result.insertId;
}

async function update(id, { name, slug, description }, executor = pool) {
  const [result] = await executor.execute(
    `UPDATE categories
     SET name = ?, slug = ?, description = ?
     WHERE id = ?`,
    [name, slug, description, id]
  );

  return result.affectedRows;
}

async function remove(id, executor = pool) {
  await executor.execute('DELETE FROM category_follows WHERE category_id = ?', [id]);
  const [result] = await executor.execute(
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

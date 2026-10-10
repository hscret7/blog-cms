const mysql = require('mysql2/promise');
const { database } = require('./env');

const pool = mysql.createPool({
  ...database,
  charset: 'utf8mb4',
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 20,
  connectTimeout: 5000,
  multipleStatements: false
});

module.exports = pool;
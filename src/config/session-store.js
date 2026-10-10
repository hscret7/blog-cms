const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const pool = require('./database');

function createSessionStore(options = {}) {
  const store = new MySQLStore(
    {
      createDatabaseTable: false,
      endConnectionOnClose: false,
      clearExpired: true,
      checkExpirationInterval: 15 * 60 * 1000,
      expiration: 8 * 60 * 60 * 1000,
      schema: {
        tableName: 'sessions',
        columnNames: {
          session_id: 'session_id',
          expires: 'expires',
          data: 'data'
        }
      },
      ...options
    },
    pool
  );

  store.on('error', (error) => {
    console.error(
      'Session store gặp lỗi:',
      error.code || 'UNKNOWN'
    );
  });

  return store;
}

module.exports = { createSessionStore };
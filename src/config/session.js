const expressSession = require('express-session');
const { session: sessionConfig } = require('./env');
const { createSessionStore } = require('./session-store');

const sessionStore = createSessionStore();

const sessionMiddleware = expressSession({
  name: 'blogcms.sid',
  secret: sessionConfig.secret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 8 * 60 * 60 * 1000
  }
});

module.exports = {
  sessionStore,
  sessionMiddleware
};
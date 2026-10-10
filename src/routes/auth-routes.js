const express = require('express');
const {
  showLogin,
  login,
  showAccount,
  logout
} = require('../controllers/auth-controller');
const { requireCsrf } = require('../middlewares/csrf');
const {
  requireAuth,
  requireRole
} = require('../middlewares/auth');
const { loginRateLimit } = require('../middlewares/login-rate-limit');

const router = express.Router();

const parseForm = express.urlencoded({
  extended: false,
  limit: '10kb',
  parameterLimit: 10
});

router.get('/login', showLogin);

router.post('/login', loginRateLimit, parseForm, requireCsrf, login);

router.get('/account', requireAuth, showAccount);

router.post('/logout', parseForm, requireCsrf, logout);

router.get(
  '/admin',
  requireAuth,
  requireRole('ADMIN'),
  (req, res) => {
    return res.render('admin', {
      user: req.user
    });
  }
);

module.exports = router;
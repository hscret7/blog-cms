const express = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/account-controller');
const { requireAuth } = require('../middlewares/auth');
const { requireCsrf } = require('../middlewares/csrf');
const router = express.Router();
const parse = express.urlencoded({ extended: false, limit: '12kb', parameterLimit: 10 });
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
  handler(req, res) { res.set('Cache-Control', 'no-store'); res.status(429).json({ message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' }); }
});
for (const [url, mode, handler] of [
  ['/register', 'register', controller.register], ['/forgot-password', 'forgot', controller.forgot],
  ['/reset-password', 'reset', controller.reset], ['/verify-email', 'verify', controller.verify]
]) {
  router.get(url, controller.page(mode));
  router.post(url, limiter, parse, requireCsrf, handler);
}
router.post('/account/verify-email', requireAuth, limiter, parse, requireCsrf, controller.resend);
for (const [url, mode, handler] of [['/account/profile', 'profile', controller.profile], ['/account/password', 'password', controller.password]]) {
  router.get(url, requireAuth, controller.page(mode));
  router.post(url, requireAuth, limiter, parse, requireCsrf, handler);
}
module.exports = router;

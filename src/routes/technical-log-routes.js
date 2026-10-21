const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const controller = require('../controllers/technical-log-controller');

const router = express.Router();

router.get(
  '/admin/system-logs',
  requireAuth,
  requireRole('ADMIN'),
  controller.showLogs
);

module.exports = router;

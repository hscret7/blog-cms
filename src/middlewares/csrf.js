const {
  randomBytes,
  timingSafeEqual
} = require('node:crypto');

function getCsrfToken(req) {
  if (!req.session) {
    throw new Error('CSRF cần middleware session chạy trước.');
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }

  return req.session.csrfToken;
}

function requireCsrf(req, res, next) {
  const expected = req.session?.csrfToken;
  const received = req.body?._csrf;

  if (
    typeof expected !== 'string' ||
    typeof received !== 'string' ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !/^[a-f0-9]{64}$/.test(received)
  ) {
    return rejectRequest(res);
  }

  const matches = timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(received, 'hex')
  );

  if (!matches) {
    return rejectRequest(res);
  }

  return next();
}

function rejectRequest(res) {
  res.set('Cache-Control', 'no-store');

  return res.status(403).json({
    message: 'Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.'
  });
}

module.exports = {
  getCsrfToken,
  requireCsrf
};
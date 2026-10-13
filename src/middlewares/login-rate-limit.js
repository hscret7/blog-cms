const { rateLimit, MemoryStore } = require('express-rate-limit');

function createLoginRateLimiter(options = {}) {
  const store = options.store || new MemoryStore();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store,
    ...options,
    handler(req, res, _next, opts) {
      res.set('Cache-Control', 'no-store');

      if (req.get('accept')?.includes('text/html')) {
        const retryAfter=Math.max(1,Math.ceil(((req.rateLimit?.resetTime?.getTime() || Date.now()+opts.windowMs)-Date.now())/1000));
        return res.status(opts.statusCode || 429).render('auth/rate-limit',{retryAfter});
      }
      return res.status(opts.statusCode || 429).json({
        message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.'
      });
    }
  });

  limiter.store = store;
  return limiter;
}

const loginRateLimit = createLoginRateLimiter();

module.exports = {
  createLoginRateLimiter,
  loginRateLimit
};


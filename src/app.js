const express = require('express');
const path = require('node:path');
const authRoutes = require('./routes/auth-routes');
const categoryRoutes = require('./routes/category-routes');
const adminUserRoutes = require('./routes/admin-user-routes');
const postRoutes = require('./routes/post-routes');
const publicPostRoutes = require('./routes/public-post-routes');
const coverRoutes = require('./routes/cover-routes');
const accountRoutes = require('./routes/account-routes');
const communityRoutes = require('./routes/community-routes');
const { optionalAuth } = require('./middlewares/auth');
const pool = require('./config/database');
const { sessionMiddleware } = require('./config/session');

const app = express();

const trustedProxyIp = process.env.TRUSTED_PROXY_IP;

if (trustedProxyIp !== undefined && trustedProxyIp !== '') {
  const { isIP } = require('node:net');

  if (isIP(trustedProxyIp) !== 4) {
    throw new Error('TRUSTED_PROXY_IP phải là một địa chỉ IPv4 hợp lệ.');
  }

  app.set('trust proxy', trustedProxyIp);
}

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, '../views'));

// Chỉ phục vụ tài nguyên giao diện; ảnh bài viết vẫn đi qua route có kiểm tra quyền.
for (const directory of ['css', 'js']) {
  app.use('/' + directory, express.static(
    path.resolve(__dirname, '../public', directory),
    { index: false, dotfiles: 'deny' }
  ));
}

app.use((req, res, next) => {
  res.locals.currentUser = null;
  res.locals.currentPath = req.path;
  next();
});

app.get('/health/live', (req, res) => {
  res.json({
    status: 'ok',
    service: 'blog-cms'
  });
});

app.get('/health/ready', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    await pool.query({
      sql: 'SELECT 1 AS ok',
      timeout: 3000
    });

    return res.status(200).json({
      status: 'ok',
      service: 'blog-cms',
      database: 'connected'
    });
  } catch (error) {
    console.error(
      'Kiểm tra database thất bại:',
      error.code || 'UNKNOWN'
    );

    return res.status(503).json({
      status: 'unavailable',
      service: 'blog-cms',
      database: 'unavailable'
    });
  }
});

// Session nhận diện người đọc, không tạo phiên mới nếu không thay đổi dữ liệu.
app.use(sessionMiddleware);
app.use(optionalAuth);
app.use(async (req, res, next) => {
  res.locals.unreadCount = 0;
  if (req.user) {
    const [rows] = await pool.execute('SELECT COUNT(*) total FROM notifications WHERE user_id=? AND read_at IS NULL', [req.user.id]);
    res.locals.unreadCount = Number(rows[0].total);
  }
  next();
});
app.use(publicPostRoutes);
app.use(accountRoutes);
app.use(communityRoutes);
app.use(coverRoutes);
app.use(authRoutes);
app.use(categoryRoutes);
app.use(adminUserRoutes);
app.use(postRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Không tìm thấy đường dẫn'
  });
});

app.use((error, req, res, next) => {
  console.error(
    'Xử lý yêu cầu thất bại:',
    error.code || 'UNKNOWN'
  );

  if (res.headersSent) {
    return next(error);
  }

  if ([400,403,413,429].includes(error.status)) return res.status(error.status).render('public/error', { statusCode: error.status, message: error.status === 413 ? 'Dữ liệu biểu mẫu vượt giới hạn cho phép.' : 'Yêu cầu hoặc bộ lọc không hợp lệ. Vui lòng kiểm tra lại.', errors: {} });
  return res.status(500).json({
    message: 'Có lỗi xảy ra khi xử lý yêu cầu'
  });
});

module.exports = app;

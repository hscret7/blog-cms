const express = require('express');
const path = require('node:path');
const authRoutes = require('./routes/auth-routes');
const categoryRoutes = require('./routes/category-routes');
const adminUserRoutes = require('./routes/admin-user-routes');
const postRoutes = require('./routes/post-routes');
const publicPostRoutes = require('./routes/public-post-routes');
const coverRoutes = require('./routes/cover-routes');
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

// Trang chủ và chi tiết bài công khai không cần session.
app.use(publicPostRoutes);

// Các chức năng tài khoản và quản lý sử dụng session.
app.use(sessionMiddleware);
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

  return res.status(500).json({
    message: 'Có lỗi xảy ra khi xử lý yêu cầu'
  });
});

module.exports = app;
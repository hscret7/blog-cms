const express = require('express');
const path = require('node:path');
const authRoutes = require('./routes/auth-routes');
const pool = require('./config/database');
const { sessionMiddleware } = require('./config/session');
const app = express();

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, '../views'));

app.get('/', (req, res) => {
  res.type('html').send(`
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Blog CMS</title>
      </head>
      <body>
        <h1>Hệ thống Blog CMS</h1>
        <p>Ứng dụng Express đã chạy thành công.</p>
        <p>Đang xây dựng chức năng bài viết, danh mục và người dùng.</p>
      </body>
    </html>
  `);
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
app.use(sessionMiddleware);
app.use(authRoutes);

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
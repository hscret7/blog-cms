const express = require('express');

const app = express();

app.disable('x-powered-by');

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

app.use((req, res) => {
  res.status(404).json({
    message: 'Không tìm thấy đường dẫn'
  });
});

module.exports = app;
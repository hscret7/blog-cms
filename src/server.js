const app = require('./app');

const host = process.env.HOST || '127.0.0.1';
const portText = process.env.PORT || '18090';

if (!/^\d+$/.test(portText)) {
  console.error('PORT phải là số nguyên từ 1 đến 65535.');
  process.exit(1);
}

const port = Number(portText);

if (port < 1 || port > 65535) {
  console.error('PORT phải nằm trong khoảng 1 đến 65535.');
  process.exit(1);
}

const server = app.listen(port, host);

server.on('listening', () => {
  console.log(`Blog CMS đang chạy tại http://${host}:${port}`);
});

server.on('error', (error) => {
  console.error(`Không khởi động được server: ${error.message}`);
  process.exit(1);
});
const app = require('./app');
const pool = require('./config/database');
const { sessionStore } = require('./config/session');

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
  console.error(
    'Không khởi động được server:',
    error.code || 'UNKNOWN'
  );
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Nhận ${signal}, đang dừng ứng dụng...`);

  const timeout = setTimeout(() => {
    console.error('Dừng ứng dụng quá thời gian cho phép.');
    process.exit(1);
  }, 10_000);

  try {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    try {
      await sessionStore.close();
    } finally {
      await pool.end();
    }

    console.log('Đã đóng HTTP server, session store và MySQL pool.');
  } catch (error) {
    console.error(
      'Dừng ứng dụng thất bại:',
      error.code || 'UNKNOWN'
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
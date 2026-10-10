const pool = require('../src/config/database');
const {
  validatePassword,
  hashPassword
} = require('../src/services/password-service');

async function main() {
  try {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('Hãy chạy script trực tiếp trong terminal.');
    }

    const { input, password } = await import('@inquirer/prompts');

    // Kiểm tra kết nối trước khi hỏi thông tin.
    await pool.query('SELECT 1');

    const name = (
      await input({
        message: 'Tên hiển thị của AUTHOR:',
        validate(value) {
          const length = Array.from(value.trim()).length;

          return (
            (length >= 1 && length <= 100) ||
            'Tên phải có từ 1 đến 100 ký tự.'
          );
        }
      })
    ).trim();

    const email = (
      await input({
        message: 'Email đăng nhập của AUTHOR:',
        validate(value) {
          const normalized = value.trim().toLowerCase();

          // Kiểm tra định dạng cơ bản cho tài khoản khởi tạo.
          return (
            (normalized.length <= 254 &&
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) ||
            'Nhập email hợp lệ, tối đa 254 ký tự.'
          );
        }
      })
    ).trim().toLowerCase();

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      throw new Error('Email đã tồn tại. Không thay đổi tài khoản cũ.');
    }

    const plainPassword = await password({
      message: 'Mật khẩu AUTHOR, từ 15 đến 128 ký tự:',
      mask: '*',
      validate(value) {
        try {
          validatePassword(value);
          return true;
        } catch (error) {
          return error.message;
        }
      }
    });

    const confirmation = await password({
      message: 'Nhập lại mật khẩu AUTHOR:',
      mask: '*',
      validate(value) {
        return (
          value === plainPassword ||
          'Hai lần nhập mật khẩu chưa giống nhau.'
        );
      }
    });

    if (confirmation !== plainPassword) {
      throw new Error('Mật khẩu xác nhận không khớp.');
    }

    const passwordHash = await hashPassword(plainPassword);

    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (?, ?, ?, 'AUTHOR', 'ACTIVE')`,
      [name, email, passwordHash]
    );

    console.log(`Đã tạo AUTHOR thành công. ID: ${result.insertId}`);
    console.log(`Email đăng nhập: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  if (error.name === 'ExitPromptError') {
    console.error('Đã hủy thao tác tạo AUTHOR.');
  } else if (error.code === 'ER_DUP_ENTRY') {
    console.error('Email đã tồn tại. Không tạo thêm tài khoản.');
  } else if (error.code) {
    console.error(`Không tạo được AUTHOR. Mã lỗi: ${error.code}`);
  } else {
    console.error(error.message);
  }

  process.exitCode = 1;
});


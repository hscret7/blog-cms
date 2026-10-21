const argon2 = require('argon2');

function validatePassword(password) {
  if (typeof password !== 'string') {
    throw new Error('Mật khẩu phải là chuỗi.');
  }

  const length = Array.from(password).length;

  if (length < 8 || length > 128) {
    throw new Error('Mật khẩu phải có từ 8 đến 128 ký tự.');
  }

  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[!-/:-@[-`{-~]/.test(password)
  ) {
    throw new Error(
      'Mật khẩu phải có chữ hoa (A–Z), chữ thường (a–z), ' +
      'chữ số (0–9) và ít nhất một ký tự đặc biệt.'
    );
  }
}

async function hashPassword(password) {
  validatePassword(password);

  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

async function verifyPassword(hash, password) {
  if (
    typeof hash !== 'string' ||
    typeof password !== 'string' ||
    Array.from(password).length > 128
  ) {
    return false;
  }

  return argon2.verify(hash, password);
}

module.exports = {
  validatePassword,
  hashPassword,
  verifyPassword
};
const { validatePassword } = require('../services/password-service');

function validateUserId(value) {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value)
  ) {
    return {
      isValid: false,
      error: 'ID người dùng không hợp lệ.'
    };
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 4294967295) {
    return {
      isValid: false,
      error: 'ID người dùng không hợp lệ.'
    };
  }

  return { isValid: true, id };
}

function validateUserInput(input, { creating = false } = {}) {
  const errors = {};
  const data = {};

  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    return {
      isValid: false,
      errors: { form: 'Dữ liệu biểu mẫu không hợp lệ.' },
      data
    };
  }

  if (typeof input.name !== 'string') {
    errors.name = 'Tên phải có từ 1 đến 100 ký tự.';
  } else {
    const name = input.name.trim().normalize('NFC');
    const length = Array.from(name).length;

    if (length < 1 || length > 100) {
      errors.name = 'Tên phải có từ 1 đến 100 ký tự.';
    } else {
      data.name = name;
    }
  }

  if (typeof input.email !== 'string') {
    errors.email = 'Nhập email hợp lệ, tối đa 254 ký tự.';
  } else {
    const email = input.email.trim().toLowerCase();

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      errors.email = 'Nhập email hợp lệ, tối đa 254 ký tự.';
    } else {
      data.email = email;
    }
  }

  if (!['ADMIN', 'AUTHOR'].includes(input.role)) {
    errors.role = 'Vai trò phải là ADMIN hoặc AUTHOR.';
  } else {
    data.role = input.role;
  }

  if (creating) {
    try {
      validatePassword(input.password);
    } catch (error) {
      errors.password = error.message;
    }

    if (
      typeof input.password_confirmation !== 'string' ||
      input.password_confirmation !== input.password
    ) {
      errors.password_confirmation = 'Hai lần nhập mật khẩu chưa giống nhau.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data
  };
}

module.exports = {
  validateUserId,
  validateUserInput
};
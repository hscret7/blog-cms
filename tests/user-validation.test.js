const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateUserId,
  validateUserInput
} = require('../src/validators/user-validator');

function validInput(overrides = {}) {
  return {
    name: 'Minh Huệ',
    email: 'user@example.invalid',
    role: 'AUTHOR',
    ...overrides
  };
}

test('Chuẩn hóa tên Unicode và email', () => {
  const result = validateUserInput(validInput({
    name: '  Minh Hue\u0323\u0302  ',
    email: '  USER@EXAMPLE.INVALID  '
  }));

  assert.equal(result.isValid, true);
  assert.equal(result.data.name, 'Minh Huệ');
  assert.equal(result.data.email, 'user@example.invalid');
  assert.equal(result.data.role, 'AUTHOR');
});

test('Giới hạn tên theo ký tự Unicode', () => {
  assert.equal(
    validateUserInput(validInput({ name: '😀'.repeat(100) })).isValid,
    true
  );

  for (const name of ['', '   ', '😀'.repeat(101), null, [], 123]) {
    const result = validateUserInput(validInput({ name }));
    assert.equal(result.isValid, false);
    assert.ok(result.errors.name);
  }
});

test('Kiểm tra email và giới hạn 254 ký tự', () => {
  const boundaryEmail = `${'a'.repeat(242)}@example.com`;
  assert.equal(boundaryEmail.length, 254);

  assert.equal(
    validateUserInput(validInput({ email: boundaryEmail })).isValid,
    true
  );

  for (const email of [
    `a${boundaryEmail}`,
    '',
    'email-khong-hop-le',
    'a b@example.com',
    'a@@example.com',
    null,
    []
  ]) {
    const result = validateUserInput(validInput({ email }));
    assert.equal(result.isValid, false);
    assert.ok(result.errors.email);
  }
});

test('Chỉ chấp nhận vai trò ADMIN, AUTHOR hoặc READER', () => {
  for (const role of ['ADMIN', 'AUTHOR']) {
    assert.equal(
      validateUserInput(validInput({ role })).isValid,
      true
    );
  }

  for (const role of ['admin', 'GUEST', '', null, ['ADMIN']]) {
    const result = validateUserInput(validInput({ role }));
    assert.equal(result.isValid, false);
    assert.ok(result.errors.role);
  }
});

test('Tạo tài khoản yêu cầu mật khẩu từ 15 đến 128 ký tự', () => {
  for (const length of [15, 128]) {
    const password = '😀'.repeat(length);

    const result = validateUserInput(validInput({
      password,
      password_confirmation: password
    }), { creating: true });

    assert.equal(result.isValid, true);
    assert.equal(Object.hasOwn(result.data, 'password'), false);
    assert.equal(
      Object.hasOwn(result.data, 'password_confirmation'),
      false
    );
  }

  for (const password of [
    undefined,
    null,
    [],
    'a'.repeat(14),
    'a'.repeat(129)
  ]) {
    const result = validateUserInput(validInput({
      password,
      password_confirmation: password
    }), { creating: true });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.password);
  }
});

test('Từ chối mật khẩu xác nhận thiếu hoặc không khớp', () => {
  for (const confirmation of [undefined, null, [], 'mat-khau-khac']) {
    const result = validateUserInput(validInput({
      password: 'Mat khau kiem thu 2026!',
      password_confirmation: confirmation
    }), { creating: true });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.password_confirmation);
  }
});

test('Sửa thông tin không yêu cầu mật khẩu và chỉ lấy trường cho phép', () => {
  const result = validateUserInput(validInput({
    id: 99,
    status: 'LOCKED',
    password: 'khong-duoc-dua-vao-data',
    password_hash: 'hash-gia',
    unexpected: 'truong-la'
  }));

  assert.equal(result.isValid, true);
  assert.deepEqual(result.data, {
    name: 'Minh Huệ',
    email: 'user@example.invalid',
    role: 'AUTHOR'
  });
});

test('Từ chối payload không hợp lệ hoặc thiếu trường', () => {
  for (const input of [undefined, null, [], 'text', 123]) {
    const result = validateUserInput(input);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.form);
    assert.deepEqual(result.data, {});
  }

  const missing = validateUserInput({});
  assert.equal(missing.isValid, false);
  assert.ok(missing.errors.name);
  assert.ok(missing.errors.email);
  assert.ok(missing.errors.role);
});

test('Kiểm tra ID trong phạm vi INT UNSIGNED', () => {
  assert.deepEqual(validateUserId('1'), {
    isValid: true,
    id: 1
  });

  assert.deepEqual(validateUserId('4294967295'), {
    isValid: true,
    id: 4294967295
  });

  for (const value of [
    '0',
    '-1',
    '01',
    '1.5',
    '1e2',
    ' 1',
    '4294967296',
    '999999999999999999999',
    '',
    undefined,
    null,
    1,
    ['1']
  ]) {
    assert.equal(validateUserId(value).isValid, false);
  }
});
test('Vai trò READER hợp lệ, không nhận vai trò ngoài danh sách', () => {
  assert.equal(validateUserInput({ name:'Độc giả', email:'reader@example.invalid', role:'READER' }).isValid,true);
  assert.equal(validateUserInput({ name:'Độc giả', email:'reader@example.invalid', role:'SUPERADMIN' }).isValid,false);
});

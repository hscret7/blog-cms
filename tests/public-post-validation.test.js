const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validatePublicQuery,
  validatePublicSlug
} = require('../src/validators/public-post-validator');

test('Truy vấn rỗng dùng giá trị mặc định', () => {
  assert.deepEqual(validatePublicQuery({}), {
    isValid: true,
    errors: {},
    data: {
      q: '',
      category_id: null,
      page: 1
    }
  });
});

test('Chuẩn hóa từ khóa và chuyển ID, số trang thành số', () => {
  const result = validatePublicQuery({
    q: '  Công nghệ  ',
    category_id: '4',
    page: '2'
  });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.data, {
    q: 'Công nghệ',
    category_id: 4,
    page: 2
  });
});

test('Danh mục rỗng tương ứng không lọc', () => {
  const result = validatePublicQuery({
    q: '   ',
    category_id: ''
  });

  assert.equal(result.isValid, true);
  assert.equal(result.data.q, '');
  assert.equal(result.data.category_id, null);
});

test('Từ khóa giới hạn theo ký tự Unicode', () => {
  assert.equal(
    validatePublicQuery({ q: '😀'.repeat(200) }).isValid,
    true
  );

  for (const q of ['😀'.repeat(201), ['a'], null, 123]) {
    assert.ok(validatePublicQuery({ q }).errors.q);
  }
});

test('Từ chối danh mục và số trang sai định dạng', () => {
  for (const value of [
    '', '0', '-1', '01', '1.5', '1e2',
    '4294967296', ['1'], null, 1
  ]) {
    assert.ok(validatePublicQuery({ page: value }).errors.page);

    if (value !== '') {
      assert.ok(
        validatePublicQuery({ category_id: value }).errors.category_id
      );
    }
  }

  assert.equal(
    validatePublicQuery({
      page: '4294967295',
      category_id: '4294967295'
    }).isValid,
    true
  );
});

test('Từ chối payload truy vấn sai kiểu', () => {
  for (const value of [undefined, null, [], 'text', 123]) {
    assert.equal(validatePublicQuery(value).isValid, false);
  }
});

test('Kiểm tra slug công khai', () => {
  for (const slug of ['bai-viet-1', 'a', 'a'.repeat(220)]) {
    assert.equal(validatePublicSlug(slug), true);
  }

  for (const slug of [
    '', 'Bai-viet', 'bài-viết', '-bai', 'bai-',
    'bai--viet', 'bai viet', 'a'.repeat(221), [], null
  ]) {
    assert.equal(validatePublicSlug(slug), false);
  }
});
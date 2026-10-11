const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_CONTENT_BYTES,
  validatePostId,
  validatePostInput
} = require('../src/validators/post-validator');

function validInput(overrides = {}) {
  return {
    title: 'Bài viết tiếng Việt',
    slug: 'bai-viet-tieng-viet',
    content: 'Dòng thứ nhất.\n  Dòng thứ hai.',
    category_id: '1',
    ...overrides
  };
}

test('Chuẩn hóa dữ liệu và giữ nguyên định dạng nội dung', () => {
  const input = validInput({
    title: '  Bài viết tiếng Việt  ',
    slug: '  BAI-VIET-TIENG-VIET  '
  });

  const result = validatePostInput(input);

  assert.equal(result.isValid, true);
  assert.equal(result.data.title, 'Bài viết tiếng Việt');
  assert.equal(result.data.slug, 'bai-viet-tieng-viet');
  assert.equal(result.data.content, input.content);
  assert.equal(result.data.category_id, 1);
});

test('Kiểm tra giới hạn tiêu đề theo ký tự Unicode', () => {
  assert.equal(
    validatePostInput(validInput({ title: '😀'.repeat(200) })).isValid,
    true
  );

  for (const title of ['', '   ', '😀'.repeat(201), [], null]) {
    assert.ok(validatePostInput(validInput({ title })).errors.title);
  }
});

test('Kiểm tra định dạng và giới hạn slug', () => {
  assert.equal(
    validatePostInput(validInput({ slug: 'a'.repeat(220) })).isValid,
    true
  );

  for (const slug of [
    '', '-bai', 'bai-', 'bai--viet', 'bài-viết',
    'bai viet', 'a'.repeat(221), ['bai-viet'], null
  ]) {
    assert.ok(validatePostInput(validInput({ slug })).errors.slug);
  }
});

test('Giới hạn nội dung theo byte UTF-8', () => {
  const atLimit = 'a'.repeat(MAX_CONTENT_BYTES);

  assert.equal(
    validatePostInput(validInput({ content: atLimit })).isValid,
    true
  );

  for (const content of [
    '',
    ' \n\t ',
    atLimit + 'a',
    'ế'.repeat(Math.floor(MAX_CONTENT_BYTES / 3) + 1),
    [],
    null
  ]) {
    assert.ok(validatePostInput(validInput({ content })).errors.content);
  }
});

test('Từ chối ID sai kiểu, sai định dạng hoặc ngoài phạm vi', () => {
  for (const value of [
    '', '0', '-1', '01', '1.5', '1e2', ' 1 ',
    '4294967296', '999999999999999999999', 1, [], null
  ]) {
    assert.equal(validatePostId(value).isValid, false);
    assert.ok(
      validatePostInput(validInput({ category_id: value }))
        .errors.category_id
    );
  }

  assert.deepEqual(validatePostId('4294967295'), {
    isValid: true,
    id: 4294967295
  });
});

test('Từ chối payload không hợp lệ hoặc thiếu trường', () => {
  for (const input of [undefined, null, [], 'text', 123]) {
    assert.equal(validatePostInput(input).isValid, false);
  }

  const result = validatePostInput({});
  assert.equal(result.isValid, false);

  for (const field of ['title', 'slug', 'content', 'category_id']) {
    assert.ok(result.errors[field]);
  }
});

test('Không đưa trường tác giả và xuất bản từ biểu mẫu vào dữ liệu', () => {
  const result = validatePostInput(validInput({
    author_id: '999',
    status: 'PUBLISHED',
    published_at: '2026-01-01',
    cover_path: '../../example'
  }));

  assert.equal(result.isValid, true);
  assert.deepEqual(
    Object.keys(result.data).sort(),
    ['category_id', 'content', 'slug', 'title']
  );
});
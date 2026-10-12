const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  MAX_FILE_BYTES,
  MAX_INPUT_PIXELS,
  MAX_OUTPUT_DIMENSION,
  CoverImageError,
  prepareCoverImage
} = require('../src/services/cover-image-service');

async function makeImage(format, width = 32, height = 24) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 120, b: 180 }
    }
  }).toFormat(format).toBuffer();
}

function isImageError(status) {
  return (error) => {
    assert.ok(error instanceof CoverImageError);
    assert.equal(error.status, status);
    return true;
  };
}

test('Chấp nhận JPEG, PNG và WebP; xuất ảnh WebP hợp lệ', async () => {
  for (const format of ['jpeg', 'png', 'webp']) {
    const input = await makeImage(format);
    const result = await prepareCoverImage(input);
    const metadata = await sharp(result.buffer).metadata();

    assert.equal(result.contentType, 'image/webp');
    assert.equal(result.extension, '.webp');
    assert.equal(metadata.format, 'webp');
    assert.equal(result.width, 32);
    assert.equal(result.height, 24);
    assert.equal(metadata.width, result.width);
    assert.equal(metadata.height, result.height);
  }
});

test('Không phóng lớn ảnh nhỏ', async () => {
  const input = await makeImage('png', 16, 8);
  const result = await prepareCoverImage(input);

  assert.equal(result.width, 16);
  assert.equal(result.height, 8);
});

test('Thu nhỏ ảnh lớn và giữ tỷ lệ', async () => {
  const input = await makeImage('jpeg', 2000, 1000);
  const result = await prepareCoverImage(input);

  assert.equal(result.width, MAX_OUTPUT_DIMENSION);
  assert.equal(result.height, MAX_OUTPUT_DIMENSION / 2);
});

test('Từ chối đầu vào thiếu, rỗng hoặc sai kiểu', async () => {
  for (const input of [
    undefined,
    null,
    '',
    'anh.png',
    [],
    new Uint8Array([1, 2, 3]),
    Buffer.alloc(0)
  ]) {
    await assert.rejects(
      () => prepareCoverImage(input),
      isImageError(422)
    );
  }
});

test('Từ chối tệp vượt quá 5 MiB', async () => {
  await assert.rejects(
    () => prepareCoverImage(Buffer.alloc(MAX_FILE_BYTES + 1)),
    isImageError(413)
  );
});

test('Từ chối dữ liệu văn bản giả làm ảnh', async () => {
  const input = Buffer.from(
    'Đây chỉ là văn bản, không phải dữ liệu ảnh.',
    'utf8'
  );

  await assert.rejects(
    () => prepareCoverImage(input),
    isImageError(422)
  );
});

test('Từ chối SVG dù thư viện có thể đọc được', async () => {
  const input = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
    '<rect width="16" height="16" fill="red"/></svg>'
  );

  await assert.rejects(
    () => prepareCoverImage(input),
    isImageError(422)
  );
});

test('Từ chối ảnh vượt giới hạn số pixel dù tệp nén nhỏ', async () => {
  const width = 5000;
  const height = 4001;

  assert.ok(width * height > MAX_INPUT_PIXELS);

  const input = await makeImage('png', width, height);
  assert.ok(input.length < MAX_FILE_BYTES);

  await assert.rejects(
    () => prepareCoverImage(input),
    isImageError(422)
  );
});

test('Từ chối ảnh PNG bị cắt mất phần dữ liệu', async () => {
  const input = await makeImage('png');
  const truncated = input.subarray(0, Math.floor(input.length / 2));

  await assert.rejects(
    () => prepareCoverImage(truncated),
    isImageError(422)
  );
});
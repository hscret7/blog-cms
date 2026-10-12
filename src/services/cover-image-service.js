const sharp = require('sharp');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 20_000_000;
const MAX_OUTPUT_DIMENSION = 1600;

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

class CoverImageError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.name = 'CoverImageError';
    this.status = status;
  }
}

async function prepareCoverImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new CoverImageError('Vui lòng chọn một tệp ảnh.');
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw new CoverImageError(
      'Ảnh vượt quá dung lượng tối đa 5 MiB.',
      413
    );
  }

  let metadata;

  try {
    metadata = await sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: 'warning'
    }).metadata();
  } catch {
    throw new CoverImageError(
      'Không đọc được ảnh hoặc ảnh vượt quá giới hạn 20 triệu pixel.'
    );
  }

  if (!ALLOWED_FORMATS.has(metadata.format)) {
    throw new CoverImageError(
      'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'
    );
  }

  if ((metadata.pages || 1) !== 1) {
    throw new CoverImageError('Không chấp nhận ảnh động hoặc ảnh nhiều trang.');
  }

  if (
    !Number.isInteger(metadata.width) ||
    !Number.isInteger(metadata.height) ||
    metadata.width <= 0 ||
    metadata.height <= 0 ||
    metadata.width * metadata.height > MAX_INPUT_PIXELS
  ) {
    throw new CoverImageError(
      'Kích thước ảnh không hợp lệ hoặc vượt quá 20 triệu pixel.'
    );
  }

  let output;

  try {
    output = await sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: 'warning'
    })
      .rotate()
      .resize({
        width: MAX_OUTPUT_DIMENSION,
        height: MAX_OUTPUT_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new CoverImageError(
      'Không xử lý được ảnh. Vui lòng chọn một ảnh hợp lệ khác.'
    );
  }

  if (output.data.length > MAX_FILE_BYTES) {
    throw new CoverImageError(
      'Ảnh sau xử lý vượt quá dung lượng cho phép.',
      413
    );
  }

  return {
    buffer: output.data,
    contentType: 'image/webp',
    extension: '.webp',
    width: output.info.width,
    height: output.info.height
  };
}

module.exports = {
  MAX_FILE_BYTES,
  MAX_INPUT_PIXELS,
  MAX_OUTPUT_DIMENSION,
  CoverImageError,
  prepareCoverImage
};
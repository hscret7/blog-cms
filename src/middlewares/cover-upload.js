const multer = require('multer');
const postService = require('../services/post-service');
const { MAX_FILE_BYTES } = require('../services/cover-image-service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
    fields: 1,
    parts: 2,
    fieldSize: 256,
    fieldNameSize: 100
  }
}).single('cover');

async function requirePostAccess(req, res, next) {
  res.set('Cache-Control', 'no-store');

  const result = await postService.getPostById(
    req.params.id,
    req.user
  );

  if (!result.success) {
    return res.status(result.status).render('posts/error', {
      statusCode: result.status,
      message: result.message
    });
  }

  return next();
}

function receiveCover(req, res, next) {
  res.set('Cache-Control', 'no-store');

  if (!req.is('multipart/form-data')) {
    return res.status(415).json({
      message: 'Vui lòng gửi ảnh bằng biểu mẫu tải tệp.'
    });
  }

  upload(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          message: 'Ảnh vượt quá dung lượng tối đa 5 MiB.'
        });
      }

      if ([
        'LIMIT_FILE_COUNT',
        'LIMIT_FIELD_COUNT',
        'LIMIT_PART_COUNT',
        'LIMIT_FIELD_VALUE',
        'LIMIT_FIELD_KEY'
      ].includes(error.code)) {
        return res.status(413).json({
          message: 'Biểu mẫu tải ảnh vượt quá giới hạn cho phép.'
        });
      }

      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(422).json({
          message: 'Chỉ được gửi một ảnh trong trường cover.'
        });
      }

      return res.status(400).json({
        message: 'Biểu mẫu tải ảnh không hợp lệ.'
      });
    }

    return next(error);
  });
}

module.exports = {
  requirePostAccess,
  receiveCover
};
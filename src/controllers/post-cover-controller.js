const fs = require('node:fs/promises');
const postRepository = require('../repositories/post-repository');
const userRepository = require('../repositories/user-repository');
const { validatePostId } = require('../validators/post-validator');
const { coverStorage } = require('../services/cover-storage');
const service = require('../services/post-cover-service');

function finishOperation(req, res, result) {
  res.set('Cache-Control', 'no-store');

  if (!result.success) {
    return res.status(result.status).render('posts/error', {
      statusCode: result.status,
      message: result.message
    });
  }

  if (result.cleanupPending) {
    return res.status(200).render('posts/error', {
      statusCode: 200,
      message:
        'Thao tác đã hoàn thành, nhưng chưa dọn được tệp ảnh cũ. ' +
        'Cần kiểm tra log ứng dụng để xử lý tệp còn sót.'
    });
  }

  return res.redirect(303, `/manage/posts/${result.id}/edit`);
}

async function uploadCover(req, res) {
  const result = await service.replaceCover(
    req.params.id,
    req.user,
    req.file?.buffer
  );

  return finishOperation(req, res, result);
}

async function removeCover(req, res) {
  const result = await service.removeCover(
    req.params.id,
    req.user
  );

  return finishOperation(req, res, result);
}

async function getCover(req, res) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');

  function unavailable() {
    return res.status(404).json({
      message: 'Không tìm thấy ảnh.'
    });
  }

  const validation = validatePostId(req.params.id);
  if (!validation.isValid) {
    return unavailable();
  }

  const post = await postRepository.findCoverById(validation.id);

  if (!post || post.cover_path === null) {
    return unavailable();
  }

  if (post.status !== 'PUBLISHED') {
    const userId = req.session?.userId;

    if (!Number.isInteger(userId) || userId <= 0) {
      return unavailable();
    }

    const viewer = await userRepository.findById(userId);

    if (
      !viewer ||
      viewer.status !== 'ACTIVE' ||
      (req.session.authVersion || 0) !== viewer.session_version ||
      !['ADMIN', 'AUTHOR'].includes(viewer.role) ||
      (viewer.role !== 'ADMIN' && viewer.id !== post.author_id)
    ) {
      return unavailable();
    }
  }

  const filePath = coverStorage.resolvePath(post.cover_path);

  let image;

  try {
    image = await fs.readFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return unavailable();
    }

    throw error;
  }

  return res.type('image/webp').send(image);
}

module.exports = {
  uploadCover,
  removeCover,
  getCover
};
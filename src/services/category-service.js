const activity = require('./activity-service');
const categoryRepository = require('../repositories/category-repository');
const {
  validateCategoryId,
  validateCategoryInput
} = require('../validators/category-validator');

async function getAllCategories() {
  return categoryRepository.findAll();
}

async function getCategoryById(idParam) {
  const idValidation = validateCategoryId(idParam);
  if (!idValidation.isValid) {
    return {
      success: false,
      status: 400,
      message: idValidation.error
    };
  }

  const category = await categoryRepository.findById(idValidation.id);
  if (!category) {
    return {
      success: false,
      status: 404,
      message: 'Danh mục không tồn tại.'
    };
  }

  return {
    success: true,
    data: category
  };
}

async function createCategory(input, actor) {
  const validation = validateCategoryInput(input);
  if (!validation.isValid) {
    return {
      success: false,
      status: 422,
      errors: validation.errors,
      data: validation.data
    };
  }

  try {
    const id = await writeCategory(actor, null, 'CATEGORY_CREATE', c => categoryRepository.create(validation.data, c));
    return {
      success: true,
      id
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        status: 409,
        errors: {
          slug: 'Slug này đã được sử dụng. Vui lòng chọn slug khác.'
        },
        data: validation.data
      };
    }
    throw error;
  }
}

async function updateCategory(idParam, input, actor) {
  const idValidation = validateCategoryId(idParam);
  if (!idValidation.isValid) {
    return {
      success: false,
      status: 400,
      message: idValidation.error
    };
  }

  const existing = await categoryRepository.findById(idValidation.id);
  if (!existing) {
    return {
      success: false,
      status: 404,
      message: 'Danh mục không tồn tại.'
    };
  }

  const validation = validateCategoryInput(input);
  if (!validation.isValid) {
    return {
      success: false,
      status: 422,
      errors: validation.errors,
      data: {
        ...validation.data,
        id: idValidation.id
      }
    };
  }

  try {
    const affectedRows = await writeCategory(actor, idValidation.id, 'CATEGORY_UPDATE', c => categoryRepository.update(idValidation.id, validation.data, c));

    if (
      affectedRows === 0 &&
      !(await categoryRepository.findById(idValidation.id))
    ) {
      return {
        success: false,
        status: 404,
        message: 'Không tìm thấy danh mục.'
      };
    }
    return {
      success: true
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        status: 409,
        errors: {
          slug: 'Slug này đã được sử dụng. Vui lòng chọn slug khác.'
        },
        data: {
          ...validation.data,
          id: idValidation.id
        }
      };
    }
    throw error;
  }
}

async function deleteCategory(idParam, actor) {
  const idValidation = validateCategoryId(idParam);
  if (!idValidation.isValid) {
    return {
      success: false,
      status: 400,
      message: idValidation.error
    };
  }

  const existing = await categoryRepository.findById(idValidation.id);
  if (!existing) {
    return {
      success: false,
      status: 404,
      message: 'Danh mục không tồn tại.'
    };
  }

  try {
    const affectedRows = await writeCategory(actor, idValidation.id, 'CATEGORY_DELETE', c => categoryRepository.remove(idValidation.id, c));

    if (affectedRows === 0) {
      return {
        success: false,
        status: 404,
        message: 'Không tìm thấy danh mục.'
      };
    }
    return {
      success: true
    };
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return {
        success: false,
        status: 409,
        message: 'Danh mục đang có bài viết liên kết, không được xóa.'
      };
    }
    throw error;
  }
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};

async function writeCategory(actor, id, action, write) {
  return activity.withActor(actor, ['ADMIN'], async c => {
    if (id) {
      const [rows] = await c.execute('SELECT id FROM categories WHERE id = ? FOR UPDATE', [id]);
      if (!rows.length) return 0;
    }
    const result = await write(c);
    if (result > 0) await activity.record(c, actor.id, action, 'category', id || result);
    return result;
  });
}

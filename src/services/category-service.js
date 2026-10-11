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

async function createCategory(input) {
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
    const id = await categoryRepository.create(validation.data);
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

async function updateCategory(idParam, input) {
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
    const affectedRows = await categoryRepository.update(
      idValidation.id,
      validation.data
    );

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

async function deleteCategory(idParam) {
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
    const affectedRows = await categoryRepository.remove(idValidation.id);

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

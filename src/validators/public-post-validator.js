const { validatePostId } = require('./post-validator');

function validatePublicQuery(query) {
  const errors = {};
  const data = {
    q: '',
    category_id: null,
    page: 1
  };

  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {
      isValid: false,
      errors: { query: 'Tham số truy vấn không hợp lệ.' },
      data
    };
  }

  if (query.q !== undefined) {
    if (typeof query.q !== 'string') {
      errors.q = 'Từ khóa tìm kiếm không hợp lệ.';
    } else {
      data.q = query.q.trim();

      if (Array.from(data.q).length > 200) {
        errors.q = 'Từ khóa tìm kiếm không được quá 200 ký tự.';
      }
    }
  }

  if (query.category_id !== undefined && query.category_id !== '') {
    const result = validatePostId(query.category_id);

    if (!result.isValid) {
      errors.category_id = 'Danh mục lọc không hợp lệ.';
    } else {
      data.category_id = result.id;
    }
  }

  if (query.page !== undefined) {
    const result = validatePostId(query.page);

    if (!result.isValid) {
      errors.page = 'Số trang không hợp lệ.';
    } else {
      data.page = result.id;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data
  };
}

function validatePublicSlug(value) {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 220 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

module.exports = {
  validatePublicQuery,
  validatePublicSlug
};
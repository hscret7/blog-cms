const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const views = path.resolve(__dirname, '../views');
const admin = { id: 3, name: 'Quản trị <script>alert(1)</script>', email: 'admin@example.invalid', role: 'ADMIN', status: 'ACTIVE' };
const author = { ...admin, id: 4, name: 'Tác giả', role: 'AUTHOR' };
const category = { id: 1, name: 'Công nghệ', slug: 'cong-nghe', description: 'Một mô tả' };
const post = { id: 5, title: 'Tiêu đề <script>alert(1)</script>', slug: 'bai-thu', content: '<img src=x onerror=alert(1)>\nDòng thứ hai', category_id: 1, author_name: author.name, category_name: category.name, status: 'DRAFT', cover_path: null };
const fixture = {
  user: admin, currentUser: admin, currentPath: '/account',
  email: '', csrfToken: 'test-csrf', errorMessage: null, errors: {},
  formData: { name: 'Tên thử', email: 'test@example.invalid', role: 'AUTHOR', title: 'Bài thử', slug: 'bai-thu', description: '', content: 'Nội dung', category_id: '1' },
  category, categories: [category], targetUser: author,
  users: [admin, author, { ...author, id: 5, status: 'LOCKED' }],
  post, posts: [post, { ...post, id: 6, status: 'PUBLISHED' }],
  total: 2, page: 1, totalPages: 2,
  filters: { q: '', category_id: null }, previousUrl: null, nextUrl: '/?page=2',
  publishedAtText: '12:00 13/10/2026', statusCode: 404, message: 'Không tìm thấy.',
  formAction: '/manage/posts', action: '/admin/users', creating: true, submitLabel: 'Lưu'
};
function render(file, extra = {}) {
  return ejs.render(fs.readFileSync(path.join(views, file), 'utf8'), { ...fixture, ...extra }, { filename: path.join(views, file) });
}

test('Toàn bộ trang EJS render được với menu, CSS và liên kết bỏ qua', () => {
  const files = fs.readdirSync(views, { recursive: true }).filter(file => file.endsWith('.ejs') && !file.startsWith('partials/') && !file.endsWith('/form.ejs'));
  assert.equal(files.length, 18);
  for (const file of files) {
    const html = render(file);
    assert.match(html, /href="\/css\/site.css\?v=1"/, file);
    assert.match(html, /id="main-content"/, file);
    assert.match(html, /aria-label="Điều hướng chính"/, file);
    assert.match(html, /<\/html>/, file);
  }
});

test('ADMIN vào được mọi mục quản lý từ giao diện tài khoản', () => {
  const html = render('account.ejs');
  for (const url of ['/manage/posts', '/manage/posts/new', '/admin', '/admin/categories', '/admin/users']) {
    assert.ok(html.includes(`href="${url}"`), url);
  }
  assert.match(html, /action="\/logout" method="post"/);
  assert.match(html, /name="_csrf" value="test-csrf"/);
  assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('AUTHOR không thấy menu quản lý danh mục hoặc người dùng', () => {
  const html = render('account.ejs', { user: author, currentUser: author });
  assert.match(html, /href="\/manage\/posts"/);
  assert.ok(!html.includes('href="/admin'));
});

test('Trang công khai dùng liên kết vào tài khoản và escape nội dung bài', () => {
  const html = render('public/detail.ejs', { user: undefined, currentUser: null });
  assert.match(html, /href="\/account"/);
  assert.match(html, /href="\/login"/);
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('Dòng thứ hai'));
});

test('Tìm kiếm, phân trang và ảnh vẫn giữ URL dữ liệu đã escape', () => {
  const html = render('public/index.ejs', {
    currentUser: null, filters: { q: '"><script>alert(1)</script>', category_id: 1 },
    posts: [{ ...post, cover_path: 'test.webp' }],
    nextUrl: '/?q=cong-nghe&category_id=1&page=2'
  });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /src="\/media\/posts\/5\/cover"/);
  assert.ok(html.includes('category_id=1&amp;page=2'));
  assert.match(html, /value="1" selected/);
  assert.match(render('public/index.ejs', { posts: [], total: 0 }), /Chưa có bài viết phù hợp/);
});

test('Các thao tác bài viết giữ POST, CSRF và điều kiện trạng thái', () => {
  const html = render('posts/index.ejs');
  assert.match(html, /action="\/manage\/posts\/5\/publish"/);
  assert.match(html, /action="\/manage\/posts\/6\/unpublish"/);
  assert.ok(!html.includes('/5/unpublish'));
  assert.ok(!html.includes('/6/publish'));
  assert.match(html, /action="\/manage\/posts\/5\/delete"/);
  assert.match(html, /href="\/manage\/posts\/5\/edit"/);
  assert.match(html, /href="\/posts\/bai-thu"/);
  assert.equal((html.match(/name="_csrf"/g) || []).length, 4);
});

test('Ảnh dùng form multipart riêng và form gỡ ảnh có CSRF', () => {
  const html = render('posts/edit.ejs', { post: { ...post, cover_path: 'test.webp' } });
  assert.match(html, /enctype="multipart\/form-data"/);
  assert.match(html, /action="\/manage\/posts\/5\/cover\/remove"/);
  assert.equal((html.match(/name="_csrf"/g) || []).length, 3);
  assert.ok(html.indexOf('</form>') < html.indexOf('enctype="multipart/form-data"'));
});

test('Lỗi validation render được và không điền lại mật khẩu người dùng', () => {
  const html = render('users/new.ejs', { errors: { name: '<script>bad</script>', password: 'Mật khẩu chưa hợp lệ' } });
  assert.ok(!html.includes('<script>bad</script>'));
  assert.match(html, /Mật khẩu chưa hợp lệ/);
  assert.ok(!/type="password"[^>]*value=/s.test(html));
  assert.match(render('posts/form.ejs', { categories: [] }), /href="\/admin\/categories\/new"/);
});

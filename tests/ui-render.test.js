const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const views = path.resolve(__dirname, '../views');
const admin = { id: 3, name: 'Quản trị <script>alert(1)</script>', email: 'admin@example.invalid', role: 'ADMIN', status: 'ACTIVE', email_verified_at: new Date(), session_version: 0,has_password:1 };
const author = { ...admin, id: 4, name: 'Tác giả', role: 'AUTHOR' };
const category = { id: 1, name: 'Công nghệ', slug: 'cong-nghe', description: 'Một mô tả' };
const post = { id: 5, title: 'Tiêu đề <script>alert(1)</script>', slug: 'bai-thu', content: '<img src=x onerror=alert(1)>\nDòng thứ hai', category_id: 1, author_name: author.name, category_name: category.name, status: 'DRAFT', cover_path: null };
const fixture = {
  mode:'mine',root:{id:7,name:'Độc giả',content:'Bình luận',is_deleted:0,created_at:new Date()},request:null,identity:null,clientId:'TEST.apps.googleusercontent.com',nonce:'a'.repeat(64),retryAfter:900,
  user: admin, currentUser: admin, currentPath: '/account', unreadCount: 2, query: {},
  mode: 'mine', rows: [], versions: [], selected: null,
  commentPage: { total: 0, rows: [], filters: { page: 1, sort: 'newest' }, totalPages: 1 },
  email: '', csrfToken: 'test-csrf', errorMessage: null, errors: {},
  formData: { name: 'Tên thử', email: 'test@example.invalid', role: 'AUTHOR', title: 'Bài thử', slug: 'bai-thu', description: '', content: 'Nội dung', category_id: '1' },
  category, categories: [category], targetUser: author,
  users: [admin, author, { ...author, id: 5, status: 'LOCKED' }],
  post, posts: [post, { ...post, id: 6, status: 'PUBLISHED' }],
  total: 2, page: 1, totalPages: 2,
  logs: [], allowedServices: ['app', 'nginx', 'mysql', 'phpmyadmin'],
  allowedIntervals: ['15m', '1h', '6h', '24h', '7d'], allowedErrorGroups: ['', 'all', '5xx', '4xx', 'db_error', 'connection'],
  params: { service: '', interval: '1h', errorGroup: '', keyword: '', limit: 100 }, error: null,
  filters: { q: '', category_id: null, page: 1, sort: 'newest', status: '' }, previousUrl: null, nextUrl: '/?page=2',
  publishedAtText: '12:00 13/10/2026', statusCode: 404, message: 'Không tìm thấy.',
  formAction: '/manage/posts', action: '/admin/users', creating: true, submitLabel: 'Lưu'
};
function render(file, extra = {}) {
  return ejs.render(fs.readFileSync(path.join(views, file), 'utf8'), { ...fixture, ...extra }, { filename: path.join(views, file) });
}

test('Mỗi câu trả lời có nút trả lời đúng đích, tên người nhận được escape', () => {
  const reply={id:8,parent_id:7,reply_to_id:7,reply_to_name:'Tên <script>x</script>',name:'Người B',content:'Câu B',created_at:new Date()};
  const root={id:7,name:'Người A',content:'Gốc',is_deleted:0,replies:[reply],reply_count:1};
  const detail=render('public/detail.ejs',{post:{...post,status:'PUBLISHED'},commentPage:{total:1,rows:[root],filters:{page:1,sort:'newest'},totalPages:1}});
  assert.match(detail,/name="parent_id" value="8"/);
  assert.match(detail,/Trả lời Người B/);
  assert.match(detail,/Đang trả lời/);
  assert.ok(!detail.includes('<script>x</script>'));
  const thread=render('community/thread.ejs',{root:{...root,replies:[]},rows:[reply]});
  assert.match(thread,/name="parent_id" value="8"/);
  const guest=render('community/thread.ejs',{currentUser:null,root:{...root,replies:[]},rows:[reply]});
  assert.ok(!guest.includes('name="parent_id"'));
});

test('Lọc thông báo đã ẩn giữ hidden=1 và có ô tìm kiếm', () => {
  const html = render('community/list.ejs', { mode: 'notifications', rows: [], query: { hidden: '1' } });
  assert.match(html, /name="hidden" value="1"/);
  assert.match(html, /id="q" name="q"/);
});

test('Thông báo mở bằng POST có CSRF; quản lý bình luận có liên kết công khai riêng', () => {
  const notice = render('community/list.ejs', { mode: 'notifications', rows: [{ id: 11, comment_id: 7, message: 'Chờ duyệt', read_at: null, hidden_at: null, commentState: 'Đang hiển thị', preview: '<script>x</script>', created_at: new Date() }] });
  assert.match(notice, /method="post" action="\/notifications\/11\/open"/);
  assert.match(notice, /Trạng thái hiện tại/);
  assert.ok(!notice.includes('<script>x</script>'));
  const moderation = render('community/list.ejs', { mode: 'moderation', rows: [{ id: 7, title: 'Bài', slug: 'bai-thu', name: 'Reader', status: 'APPROVED', content: 'Thử', created_at: new Date() }] });
  assert.match(moderation, /href="\/comments\/7\/go\?view=public"/);
  assert.ok(!moderation.includes('href="/comments/7/go"'));
});

test('Toàn bộ trang EJS render được với menu, CSS và liên kết bỏ qua', () => {
  const files = fs.readdirSync(views, { recursive: true }).filter(file => file.endsWith('.ejs') && !file.startsWith('partials/') && !file.endsWith('/form.ejs'));
  assert.equal(files.length, 29);
  for (const file of files) {
    const html = render(file);
    assert.match(html, /href="\/css\/site.css\?v=4"/, file);
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


test('READER không có nút quản lý bài và có thông báo, bình luận, theo dõi', () => {
  const reader = { ...author, role: 'READER' };
  const html = render('account.ejs', { user: reader, currentUser: reader });
  assert.ok(!html.includes('href="/manage/posts'));
  for (const target of ['/notifications','/my/comments','/following','/account/password','/account/profile']) assert.ok(html.includes(`href="${target}"`), target);
});

test('Biểu mẫu tài khoản render đủ sáu chế độ, password không điền lại', () => {
  for (const mode of ['register','forgot','reset','verify','profile','password']) {
    const html = render('auth/form.ejs', { mode, title: 'Tài khoản', result: {}, data: { name:'Độc giả', email:'reader@example.invalid' }, token:'' });
    assert.match(html, /name="_csrf"/);
    assert.ok(!/type="password"[^>]*value=/s.test(html));
    if (['register','reset','password','profile'].includes(mode)) assert.match(html, /data-toggle-password/);
  }
});

test('Bình luận công khai, thông báo và lịch sử escape nội dung', () => {
  const content = '<script>comment()</script>';
  const html = render('public/detail.ejs', { commentPage: { total:1,totalPages:1,filters:{page:1,sort:'newest'},rows:[{name:'Độc giả',content}] } });
  assert.ok(!html.includes(content));
  assert.match(html, /action="\/posts\/5\/comments"/);
  const history = render('posts/history.ejs', { selected: {title:'Cũ',slug:'cu',content} });
  assert.ok(!history.includes(content));
  const notices = render('community/list.ejs', { mode:'notifications',rows:[{id:1,message:content,target_path:'/account',read_at:null,created_at:new Date()}] });
  assert.ok(!notices.includes(content));
});

test('Tài khoản Google-only có luồng đặt mật khẩu, không yêu cầu mật khẩu chưa có',()=>{
 const googleOnly={...author,has_password:0};const html=render('auth/form.ejs',{mode:'password',title:'Đổi mật khẩu',result:{},data:{},token:'',user:googleOnly,currentUser:googleOnly});
 assert.match(html,/href="\/forgot-password"/);assert.ok(!html.includes('name="current_password"'));
 const settings=render('auth/google-settings.ejs',{user:googleOnly,currentUser:googleOnly,identity:{provider:'GOOGLE'}});assert.ok(!settings.includes('action="/account/google/unlink"'));assert.match(settings,/phương thức đăng nhập duy nhất/);
});
test('Bình luận có trả lời dùng ID và parent_id, nội dung luôn escape',()=>{
 const content='<script>reply()</script>';const html=render('public/detail.ejs',{commentPage:{total:1,totalPages:1,filters:{sort:'newest',page:1},rows:[{id:7,name:'Độc giả',content:'Gốc',reply_count:1,replies:[{id:8,name:'Tác giả',content}]}]}});
 assert.match(html,/id="comment-7"/);assert.match(html,/name="parent_id" value="7"/);assert.match(html,/id="comment-8"/);assert.ok(!html.includes(content));assert.match(html,/data-collapse/);
});

test('Không gian làm việc có hai cột đúng và không còn nút quay lại toàn cục',()=>{
 const html=render('account.ejs');assert.match(html,/workspace-content/);assert.match(html,/Cá nhân & cộng đồng/);assert.match(html,/href="\/account\/google"/);assert.doesNotMatch(html,/data-back|class="back-button"/);
});


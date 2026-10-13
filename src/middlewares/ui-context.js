function safePath(value, fallback = '/') {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'http://internal.invalid');
    const decoded = decodeURIComponent(url.pathname);
    if (url.origin !== 'http://internal.invalid' || decoded.startsWith('//') || /[\\\r\n]/.test(decoded)) return fallback;
    for (const key of ['code','state','token','credential','password','_csrf']) url.searchParams.delete(key);
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
function fallbackFor(path) {
  if (path.startsWith('/admin/')) return '/admin';
  if (path.startsWith('/manage/posts/')) return '/manage/posts';
  if (path.startsWith('/manage/')) return '/account';
  if (path.startsWith('/account/')) return '/account';
  if (path.startsWith('/posts/')) return '/';
  return '/';
}
function setFeedback(req, message, draftKey = null) {
  if (req.session) req.session.feedback = { message: message.slice(0,1000), draftKey };
}
function uiContext(req, res, next) {
  res.locals.feedback = req.session?.feedback || null;
  if (req.method === 'GET' && req.session) delete req.session.feedback;
  next();
}
module.exports = { safePath, fallbackFor, setFeedback, uiContext };

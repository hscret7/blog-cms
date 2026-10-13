'use strict';

// Chỉ hỗ trợ giao diện; kiểm tra quyền và dữ liệu vẫn thực hiện trên server.
document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
    button.setAttribute('aria-pressed', String(show));
  });
});

const tokenInput = document.getElementById('email-token');
if (tokenInput) {
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  if (token && /^[a-f0-9]{64}$/.test(token)) tokenInput.value = token;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

// Quay lại bằng GET trong cùng tab, giữ bộ lọc và không gửi lại POST.
function internalPath(value) {
  try { const url = new URL(value, location.origin); if (url.origin !== location.origin || /[\\]/.test(value)) return null;
    for (const key of ['code','state','token','credential','password','_csrf']) url.searchParams.delete(key);
    return url.pathname + url.search;
  } catch { return null; }
}
try {
  const owner=document.querySelector('[data-session-user]')?.dataset.sessionUser || '0';
  if(sessionStorage.getItem('cms-owner')!==owner) {
    for(const key of Object.keys(sessionStorage)) if(key.startsWith('cms-draft:')||key==='cms-navigation')sessionStorage.removeItem(key);
    sessionStorage.setItem('cms-owner',owner);
  }
} catch {}
let navigation = [];
try {
  navigation = JSON.parse(sessionStorage.getItem('cms-navigation') || '[]').filter(v => typeof v === 'string' && internalPath(v));
  const current = internalPath(location.href);
  if (!location.pathname.startsWith('/auth/google') && navigation.at(-1) !== current) navigation.push(current);
  navigation = navigation.slice(-30);sessionStorage.setItem('cms-navigation', JSON.stringify(navigation));
} catch { navigation = []; }
document.querySelectorAll('[data-back]').forEach(link => link.addEventListener('click', event => {
  if (dirty && !confirm('Bạn có thay đổi chưa lưu. Quay lại và bỏ thay đổi?')) { event.preventDefault();return; }
  if (dirty) dirty=false;
  if (navigation.length < 2) return;
  const previous = internalPath(navigation.at(-2)); if (!previous) return;
  event.preventDefault(); navigation.pop();
  try { sessionStorage.setItem('cms-navigation',JSON.stringify(navigation)); } catch {}
  location.assign(previous);
}));
document.querySelectorAll('[data-collapse]').forEach(button => button.addEventListener('click', () => {const details=button.closest('details');if(details)details.open=false;}));
document.querySelectorAll('details[data-preview]').forEach(details=>details.addEventListener('toggle',()=>{details.querySelector('summary').textContent=details.open?'Ẩn nội dung':'Xem nội dung';}));

let dirty = false;
const editableForms = [...document.querySelectorAll('form')].filter(form=>form.method.toLowerCase()==='post' && form.querySelector('textarea,input:not([type=hidden]):not([type=file]),select'));
for (const form of editableForms) { form.addEventListener('input',()=>{dirty=true;});form.addEventListener('submit',()=>{dirty=false;}); }
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
for(const form of document.querySelectorAll('form')) {
  const url=new URL(form.action,location.origin);
  if (!/^\/manage\/posts(?:\/\d+\/update)?$/.test(url.pathname) || !form.elements.content) continue;
  const key='cms-draft:'+url.pathname;const fields=['title','slug','content','category_id'];
  try {
    const saved=JSON.parse(sessionStorage.getItem(key)||'null');
    if(saved && fields.some(field=>typeof saved[field]==='string'&&saved[field]!==form.elements[field]?.value)) {
      const banner=document.createElement('div');banner.className='draft-banner';banner.textContent='Có bản nháp chưa lưu trong tab này. ';
      const restore=document.createElement('button');restore.type='button';restore.textContent='Khôi phục bản nháp';
      restore.addEventListener('click',()=>{for(const field of fields)if(typeof saved[field]==='string'&&form.elements[field])form.elements[field].value=saved[field];dirty=true;banner.remove();});
      const discard=document.createElement('button');discard.type='button';discard.textContent='Bỏ bản nháp';discard.className='button-secondary';discard.addEventListener('click',()=>{sessionStorage.removeItem(key);banner.remove();});
      banner.append(restore,discard);form.before(banner);
    }
  }catch{}
  form.addEventListener('input',()=>{try {sessionStorage.setItem(key,JSON.stringify(Object.fromEntries(fields.map(field=>[field,form.elements[field]?.value||'']))));}catch{}});
}
document.querySelectorAll('[data-clear-draft]').forEach(node=>{try{sessionStorage.removeItem('cms-draft:'+node.dataset.clearDraft);}catch{}});
const retry=document.querySelector('[data-retry-after]');
if(retry){let seconds=Number(retry.dataset.retryAfter);const timer=setInterval(()=>{seconds=Math.max(0,seconds-1);retry.textContent=String(seconds);if(!seconds)clearInterval(timer);},1000);}

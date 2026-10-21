const pool = require('../config/database');
const activity = require('./activity-service');
const { validateUserId } = require('../validators/user-validator');
const fail = (status,message)=>({success:false,status,message});
const {validReason}=require('../validators/author-request-validator');
async function request(actor, reason) {
  if (!validReason(reason)) return fail(422,'Lý do cần có từ 1 đến 1.000 ký tự.');
  return activity.withActor(actor,['READER'],async(c,user)=>{
    if (!user.email_verified_at) return fail(403,'Hãy xác minh email trước khi xin quyền tác giả.');
    const [old]=await c.execute('SELECT status FROM author_requests WHERE user_id=? FOR UPDATE',[user.id]);
    if(old[0]?.status==='PENDING') return fail(409,'Yêu cầu của bạn đang chờ duyệt.');
    await c.execute(`INSERT INTO author_requests(user_id,reason,status) VALUES (?,?,'PENDING')
      ON DUPLICATE KEY UPDATE reason=VALUES(reason),status='PENDING',review_note=NULL,reviewer_id=NULL,created_at=UTC_TIMESTAMP()`,[user.id,reason.trim()]);
    await activity.record(c,user.id,'AUTHOR_REQUEST','user',user.id);
    await c.execute(`INSERT INTO notifications(user_id,message,target_path) SELECT id,'Có yêu cầu quyền tác giả mới.',? FROM users WHERE role='ADMIN' AND status='ACTIVE'`,['/admin/author-requests?user='+user.id]);
    return {success:true,message:'Đã gửi yêu cầu. Quyền hiện tại vẫn là độc giả cho đến khi được duyệt.'};
  });
}
async function mine(actor) {const [rows]=await pool.execute('SELECT status,reason,review_note,created_at,updated_at FROM author_requests WHERE user_id=?',[actor.id]);return rows[0]||null;}
async function list(actor,query={}) {
  if(actor.role!=='ADMIN') {const e=new Error('Bạn không có quyền quản trị.');e.status=403;throw e;}
  const page=query.page===undefined?'1':query.page,q=query.q||'',status=query.status||'';
  if(!validateUserId(page).isValid||typeof q!=='string'||Array.from(q).length>100||(status&&!['PENDING','APPROVED','REJECTED'].includes(status))||(query.user&&!validateUserId(query.user).isValid)){const e=new Error('Bộ lọc không hợp lệ.');e.status=400;throw e;}
  const terms=['1=1'],values=[];
  if(status){terms.push('r.status=?');values.push(status);}if(query.user){terms.push('r.user_id=?');values.push(Number(query.user));}
  if(q){terms.push("(u.name LIKE ? ESCAPE '!' OR u.email LIKE ? ESCAPE '!')");const pattern='%'+q.trim().replace(/[!%_]/g,ch=>'!'+ch)+'%';values.push(pattern,pattern);}
  const where=terms.join(' AND '),from='author_requests r JOIN users u ON u.id=r.user_id';
  const [counts]=await pool.execute('SELECT COUNT(*) total FROM '+from+' WHERE '+where,values);const total=Number(counts[0].total),totalPages=Math.max(1,Math.ceil(total/20)),current=Math.min(Number(page),totalPages);
  const [rows]=await pool.execute('SELECT r.*,u.name,u.email,u.role,u.status user_status,u.email_verified_at FROM '+from+' WHERE '+where+' ORDER BY r.updated_at DESC,r.user_id DESC LIMIT ? OFFSET ?',[...values,20,(current-1)*20]);
  return {rows,total,totalPages,page:current,query};
}
async function review(actor,idText,input={}) {
  if(!validateUserId(idText).isValid) return fail(400,'ID người dùng không hợp lệ.');
  if(!['APPROVED','REJECTED'].includes(input.status)) return fail(400,'Kết quả duyệt không hợp lệ.');
  if(typeof input.note!=='string'||Array.from(input.note.trim()).length>1000||(input.status==='REJECTED'&&!input.note.trim())) return fail(422,'Nhập lý do từ chối, tối đa 1.000 ký tự.');
  return activity.withActor(actor,['ADMIN'],async(c,current)=>{
    const [users]=await c.execute('SELECT id,role,status,email_verified_at FROM users WHERE id=? FOR UPDATE',[Number(idText)]);
    const [rows]=await c.execute('SELECT status FROM author_requests WHERE user_id=? FOR UPDATE',[Number(idText)]);
    if(!users[0]||!rows[0])return fail(404,'Không tìm thấy yêu cầu.');
    if(rows[0].status!=='PENDING')return fail(409,'Yêu cầu đã được xử lý.');
    if(input.status==='APPROVED') {
      if(users[0].role!=='READER'||users[0].status!=='ACTIVE'||!users[0].email_verified_at)return fail(409,'Chỉ duyệt độc giả đang hoạt động và đã xác minh email.');
      await c.execute("UPDATE users SET role='AUTHOR' WHERE id=?",[users[0].id]);
    }
    await c.execute('UPDATE author_requests SET status=?,review_note=?,reviewer_id=? WHERE user_id=?',[input.status,input.note.trim()||null,current.id,users[0].id]);
    await activity.record(c,current.id,'AUTHOR_'+input.status,'user',users[0].id);
    await activity.notify(c,users[0].id,input.status==='APPROVED'?'Yêu cầu được duyệt. Bạn đã có quyền tác giả.':'Yêu cầu quyền tác giả bị từ chối. Xem lý do trong trang tài khoản.','/account/author-request');
    return {success:true,message:'Đã xử lý yêu cầu quyền tác giả.'};
  });
}
module.exports={validReason,request,mine,list,review};

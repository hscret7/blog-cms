const service=require('../services/author-request-service');
const {getCsrfToken}=require('../middlewares/csrf');
const {setFeedback}=require('../middlewares/ui-context');
function error(res,result){return res.status(result.status||500).render('public/error',{statusCode:result.status||500,message:result.message||'Không xử lý được yêu cầu.',errors:{}});}
module.exports={
 async mine(req,res){res.render('users/author-request',{request:await service.mine(req.user),csrfToken:getCsrfToken(req),user:req.user});},
 async submit(req,res){const r=await service.request(req.user,req.body?.reason);if(!r.success){if(r.status===422)return res.status(422).render('users/author-request',{request:await service.mine(req.user),csrfToken:getCsrfToken(req),user:req.user,errorMessage:r.message,formReason:typeof req.body?.reason==='string'?req.body.reason.slice(0,5000):''});return error(res,r);}setFeedback(req,r.message);res.redirect(303,'/account/author-request');},
 async list(req,res){const data=await service.list(req.user,req.query);const link=p=>{const q=new URLSearchParams(req.query);q.set('page',p);return '?'+q;};res.render('users/author-requests',{...data,csrfToken:getCsrfToken(req),previousUrl:data.page>1?link(data.page-1):null,nextUrl:data.page<data.totalPages?link(data.page+1):null});},
 async review(req,res){const r=await service.review(req.user,req.params.id,req.body);if(!r.success){if(r.status===422){const data=await service.list(req.user,{user:req.params.id});return res.status(422).render('users/author-requests',{...data,csrfToken:getCsrfToken(req),previousUrl:null,nextUrl:null,errorMessage:r.message,formNote:typeof req.body?.note==='string'?req.body.note.slice(0,5000):''});}return error(res,r);}setFeedback(req,r.message);res.redirect(303,'/admin/author-requests');}
};

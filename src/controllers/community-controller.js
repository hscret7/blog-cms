const { setFeedback }=require('../middlewares/ui-context');
const service=require('../services/community-service');
const {getCsrfToken}=require('../middlewares/csrf');
function error(res,e){return res.status(e.status||500).render('public/error',{statusCode:e.status||500,message:e.status?e.message:'Không thể thực hiện thao tác. Vui lòng thử lại.',errors:{}});}
async function list(req,res,mode){
  try{
    res.set('Cache-Control','no-store');
    const data=mode==='notifications'?await service.notifications(req.user,req.query):mode==='audit'?await service.audit(req.query):await service.list(req.user,req.query,mode==='moderation',mode==='authored');
    const params=new URLSearchParams();for(const [key,value] of Object.entries(req.query))if(typeof value==='string'&&key!=='page')params.set(key,value);
    const pageUrl=page=>{const copy=new URLSearchParams(params);copy.set('page',page);return req.path+'?'+copy;};
    return res.render('community/list',{mode,...data,csrfToken:getCsrfToken(req),previousUrl:data.filters.page>1?pageUrl(data.filters.page-1):null,nextUrl:data.filters.page<data.totalPages?pageUrl(data.filters.page+1):null,query:req.query});
  }catch(e){return error(res,e);}
}
async function mutate(req,res,operation){
  try{const result=await service.mutate(req.user,operation,req.params.id,req.body);if(!result.success){
      if(result.status===422 && ['create','edit'].includes(operation)) {
        const pool=require('../config/database');let post;
        if(operation==='create') {const [rows]=await pool.execute("SELECT id,slug,title FROM posts WHERE id=? AND status='PUBLISHED'",[req.params.id]);post=rows[0];}
        else {const [rows]=await pool.execute('SELECT p.id,p.slug,p.title FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=? AND c.user_id=? AND c.is_deleted=0',[req.params.id,req.user.id]);post=rows[0];}
        if(post)return res.status(422).render('community/comment-error',{post,formAction:operation==='create'?'/posts/'+post.id+'/comments':'/my/comments/'+req.params.id+'/edit',formData:{content:typeof req.body?.content==='string'?req.body.content.slice(0,8000):'',parent_id:typeof req.body?.parent_id==='string'?req.body.parent_id:''},errorMessage:result.message,csrfToken:getCsrfToken(req)});
      }
      return error(res,result);
    }
    setFeedback(req,result.message || 'Đã cập nhật bình luận.');
    if(operation==='create' && result.id) return res.redirect(303,result.status==='APPROVED'?'/comments/'+result.id+'/go?view=public':'/my/comments?comment='+result.id+'#comment-'+result.id);
    return res.redirect(303,req.path.startsWith('/admin/')?'/admin/comments':'/my/comments');
  }catch(e){return error(res,e);}
}
module.exports={
  list:mode=>(req,res)=>list(req,res,mode),mutate:operation=>(req,res)=>mutate(req,res,operation),
  async destination(req,res){try{res.set('Cache-Control','no-store');const r=await service.commentDestination(req.params.id,req.user,req.query.view==='public');if(!r.success)return error(res,r);res.redirect(303,r.path);}catch(e){error(res,e);}},
  async open(req,res){try{res.set('Cache-Control','no-store');const r=await service.openNotification(req.user,req.params.id);if(!r.success)return error(res,r);res.redirect(303,r.path);}catch(e){error(res,e);}},
  visibility:hidden=>async(req,res)=>{try{const r=await service.hideNotification(req.user,req.params.id,hidden);if(!r.success)return error(res,r);setFeedback(req,r.message);res.redirect(303,'/notifications'+(hidden?'':'?hidden=1'));}catch(e){error(res,e);}},
  async thread(req,res){try{
    res.set('Cache-Control','no-store');
    const result=await require('../services/public-post-service').getPublicPost(req.params.slug);
    if(!result.success)return error(res,result);
    const data=await service.thread(result.data.id,req.params.id,req.query);if(!data.success)return error(res,data);
    res.render('community/thread',{post:result.data,...data,csrfToken:getCsrfToken(req)});
  }catch(e){error(res,e);}},
  async read(req,res){try{const r=await service.markRead(req.user,req.params.id);if(!r.success)return error(res,r);setFeedback(req,'Đã cập nhật thông báo.');res.redirect(303,'/notifications');}catch(e){error(res,e);}},
  async follows(req,res){try{res.render('community/follows',{categories:await service.follows(req.user),csrfToken:getCsrfToken(req)});}catch(e){error(res,e);}},
  async follow(req,res){try{const r=await service.follow(req.user,req.params.id,req.body?.enabled==='1');if(!r.success)return error(res,r);setFeedback(req,'Đã cập nhật chủ đề theo dõi.');res.redirect(303,'/following');}catch(e){error(res,e);}}
};


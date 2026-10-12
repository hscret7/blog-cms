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
  try{const result=await service.mutate(req.user,operation,req.params.id,req.body);if(!result.success)return error(res,result);
    return res.redirect(303,req.path.startsWith('/admin/')?'/admin/comments':'/my/comments');
  }catch(e){return error(res,e);}
}
module.exports={
  list:mode=>(req,res)=>list(req,res,mode),mutate:operation=>(req,res)=>mutate(req,res,operation),
  async read(req,res){try{const r=await service.markRead(req.user,req.params.id);if(!r.success)return error(res,r);res.redirect(303,'/notifications');}catch(e){error(res,e);}},
  async follows(req,res){try{res.render('community/follows',{categories:await service.follows(req.user),csrfToken:getCsrfToken(req)});}catch(e){error(res,e);}},
  async follow(req,res){try{const r=await service.follow(req.user,req.params.id,req.body?.enabled==='1');if(!r.success)return error(res,r);res.redirect(303,'/following');}catch(e){error(res,e);}}
};

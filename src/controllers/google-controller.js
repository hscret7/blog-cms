const service=require('../services/google-service');
const {getCsrfToken}=require('../middlewares/csrf');
const {setFeedback}=require('../middlewares/ui-context');
function error(res,r){return res.status(r.status||503).render('public/error',{statusCode:r.status||503,message:r.message||'Google tạm thời chưa sẵn sàng. Vui lòng thử lại.',errors:{}});}
async function challengePage(req,res,mode,user=null){
  res.set('Cache-Control','no-store');res.set('Referrer-Policy',['localhost','127.0.0.1'].includes(req.hostname)?'no-referrer-when-downgrade':'strict-origin-when-cross-origin');
  try{const challenge=await service.issue(mode,user);req.session.googleChallenge=challenge;res.render('auth/google',{...challenge,referrerPolicy:['localhost','127.0.0.1'].includes(req.hostname)?'no-referrer-when-downgrade':'strict-origin-when-cross-origin',csrfToken:getCsrfToken(req)});}catch(e){return error(res,{status:e.status||503,message:e.status?e.message:'Google tạm thời chưa sẵn sàng.'});}
}
module.exports={
 start:(req,res)=>challengePage(req,res,'LOGIN'),
 async settings(req,res){res.set('Cache-Control','no-store');res.render('auth/google-settings',{identity:await service.linked(req.user),csrfToken:getCsrfToken(req),user:req.user,errorMessage:null});},
 async link(req,res){if(!await service.confirmLocal(req.user,req.body?.current_password))return error(res,{status:422,message:'Nhập đúng mật khẩu website để bắt đầu liên kết Google.'});return challengePage(req,res,'LINK',req.user);},
 async complete(req,res){
  res.set('Cache-Control','no-store');
  const challenge=req.session?.googleChallenge;delete req.session.googleChallenge;
  try{const result=await service.complete(req.body?.credential,challenge,req.user);if(!result.success)return res.status(result.status).json({message:result.message});
    if(result.user)await require('../services/login-session').establish(req,result.user);
    setFeedback(req,result.message||'Đã đăng nhập Google.');return res.json({redirect:result.linked?'/account/google':'/account'});
  }catch(e){console.error('Đăng nhập Google thất bại:',e.code||'GOOGLE_FAILED');return res.status(503).json({message:'Không hoàn tất được đăng nhập Google. Hãy mở lại trang và thử lại.'});}
 },
 async unlink(req,res){const result=await service.unlink(req.user,req.body?.current_password);if(!result.success)return error(res,result);
   await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));setFeedback(req,result.message);res.redirect(303,'/login');}
};

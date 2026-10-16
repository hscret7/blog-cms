const express=require('express');
const {rateLimit}=require('express-rate-limit');
const {requireAuth,requireRole,requireVerified}=require('../middlewares/auth');
const {requireCsrf}=require('../middlewares/csrf');
const controller=require('../controllers/community-controller');
const router=express.Router();
const parse=express.urlencoded({extended:false,limit:'20kb',parameterLimit:10});
const limiter=rateLimit({windowMs:60000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,
  handler(req,res){res.set('Cache-Control','no-store');res.status(429).json({message:'Bạn gửi bình luận quá nhanh. Vui lòng thử lại sau.'});}});
router.get('/comments/:id/go',controller.destination);
router.get('/posts/:slug/comments/:id',controller.thread);
router.post('/notifications/:id/hide',requireAuth,parse,requireCsrf,controller.visibility(true));
router.post('/notifications/:id/restore',requireAuth,parse,requireCsrf,controller.visibility(false));
router.get('/manage/comments',requireAuth,requireRole('ADMIN','AUTHOR'),controller.list('authored'));
router.get('/my/comments',requireAuth,controller.list('mine'));
router.post('/posts/:id/comments',requireAuth,requireVerified,limiter,parse,requireCsrf,controller.mutate('create'));
for(const op of ['edit','delete'])router.post('/my/comments/:id/'+op,requireAuth,requireVerified,limiter,parse,requireCsrf,controller.mutate(op));
router.get('/admin/comments',requireAuth,requireRole('ADMIN'),controller.list('moderation'));
for(const op of ['moderate','delete'])router.post('/admin/comments/:id/'+op,requireAuth,requireRole('ADMIN'),requireVerified,parse,requireCsrf,controller.mutate(op));
router.get('/notifications',requireAuth,controller.list('notifications'));
router.post('/notifications/:id/read',requireAuth,parse,requireCsrf,controller.read);
router.post('/notifications/:id/open',requireAuth,parse,requireCsrf,controller.open);
router.get('/following',requireAuth,controller.follows);
router.post('/following/:id',requireAuth,requireVerified,parse,requireCsrf,controller.follow);
router.get('/admin/activity',requireAuth,requireRole('ADMIN'),controller.list('audit'));
module.exports=router;


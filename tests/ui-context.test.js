const test=require('node:test'),assert=require('node:assert/strict');const {safePath,fallbackFor,uiContext}=require('../src/middlewares/ui-context');
test('Quay lại chỉ nhận đường dẫn nội bộ, bỏ token/query nhạy cảm',()=>{
 for(const url of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/%2f%2fevil.invalid','/%0d%0aevil'])assert.equal(safePath(url,'/account'),'/account');
 assert.equal(safePath('/manage/posts?page=2&status=DRAFT&token=hidden'),'/manage/posts?page=2&status=DRAFT');assert.equal(fallbackFor('/account/password'),'/account');
});
test('Feedback tiêu thụ khi GET, navigation giữ bộ lọc và lưu trước render',()=>{
 const req={method:'GET',path:'/manage/posts/5/edit',originalUrl:'/manage/posts/5/edit',query:{},session:{feedback:{message:'Đã lưu'},lastUiPath:'/manage/posts?page=2'}};const res={locals:{},statusCode:200,render(){}};
 uiContext(req,res,()=>{});res.render('posts/edit',{});assert.equal(res.locals.feedback.message,'Đã lưu');assert.equal(req.session.feedback,undefined);assert.equal(res.locals.backUrl,'/manage/posts?page=2');assert.equal(req.session.lastUiPath,'/manage/posts/5/edit');
});

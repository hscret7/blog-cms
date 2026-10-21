const test=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-module');
function fixture(status='DRAFT',version=1){
 const state={read:false,status:200};
 const controller=load('src/controllers/post-cover-controller.js',{
 '../services/post-cover-service':{},'../repositories/post-repository':{findCoverById:async()=>({id:5,status,author_id:4,cover_path:'test.webp'})},
 '../repositories/user-repository':{findById:async()=>({id:4,role:'AUTHOR',status:'ACTIVE',session_version:1})},
 '../services/cover-storage':{coverStorage:{resolvePath:()=>'/test.webp'}},'node:fs/promises':{readFile:async()=>{state.read=true;return Buffer.from('fixture');}}
 });
 const req={params:{id:'5'},session:{userId:4,authVersion:version}};const res={set(){},status(code){state.status=code;return this;},json(){},type(){return this;},send(){return this;}};
 return{controller,state,req,res};
}
test('Phiên cũ sau reset không đọc được ảnh bài nháp',async()=>{
 const f=fixture('DRAFT',0);await f.controller.getCover(f.req,f.res);assert.equal(f.state.status,404);assert.equal(f.state.read,false);
});
test('Ảnh đã xuất bản vẫn công khai khi không có phiên',async()=>{
 const f=fixture('PUBLISHED');f.req.session=undefined;await f.controller.getCover(f.req,f.res);assert.equal(f.state.status,200);assert.equal(f.state.read,true);
});

const test=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers/load-module');
function fixture({allowed=true,version=true}={}) {
 const state={queries:[],status:200,view:null};
 const controller=load('src/controllers/post-history-controller.js',{
 '../config/database':{async execute(sql,values){state.queries.push({sql,values});if(sql.startsWith('SELECT COUNT'))return[[{total:12}]];if(sql.startsWith('SELECT title'))return[[...(version?[{title:'Cũ'}]:[])]];return[[]];}},
 '../services/post-service':{getPostById:async()=>allowed?{success:true,data:{id:5}}:{success:false,status:404,message:'Không có quyền'}}});
 const req={params:{id:'5'},user:{id:4,role:'AUTHOR'},query:{}};const res={set(){},status(code){state.status=code;return this;},render(view,data){state.view=view;state.data=data;}};return{controller,state,req,res};
}
test('Lịch sử của người khác bị chặn trước truy vấn phiên bản',async()=>{
 const f=fixture({allowed:false});await f.controller.showHistory(f.req,f.res);assert.equal(f.state.status,404);assert.equal(f.state.queries.length,0);
});
test('Đọc phiên bản phải khớp đồng thời version ID và post ID',async()=>{
 const f=fixture();f.req.query={version:'12',page:'2'};await f.controller.showHistory(f.req,f.res);
 const selected=f.state.queries.find(c=>c.sql.startsWith('SELECT title'));assert.match(selected.sql,/WHERE id = \? AND post_id = \?/);assert.equal(selected.values[1],5);assert.equal(f.state.data.page,2);
});
test('Phiên bản không tồn tại hoặc phân trang sai trả lỗi',async()=>{
 const f=fixture({version:false});f.req.query.version='12';await f.controller.showHistory(f.req,f.res);assert.equal(f.state.status,404);
 const invalid=fixture();invalid.req.query.page='abc';await invalid.controller.showHistory(invalid.req,invalid.res);assert.equal(invalid.state.status,400);assert.equal(invalid.state.queries.length,0);
});

const assert=require('node:assert/strict');const test=require('node:test');const {load}=require('./helpers/load-module');
function db(){const calls=[];return {calls,async execute(sql,values=[]){calls.push({sql,values});if(sql.startsWith('SELECT COUNT'))return[[{total:2}]];return[[]];}};}
test('Tìm kiếm công khai tìm tiêu đề/nội dung bằng tham số, escape ký tự LIKE',async()=>{
 const pool=db();const repo=load('src/repositories/public-post-repository.js',{'../config/database':pool});
 await repo.findPublishedPage({q:"%_!' OR 1=1",sort:'title'},{limit:10,offset:0});
 const call=pool.calls[0];assert.match(call.sql,/p.title LIKE \?/);assert.match(call.sql,/p.content LIKE \?/);assert.match(call.sql,/p.status = 'PUBLISHED'/);assert.match(call.sql,/ORDER BY p.title ASC/);assert.ok(!call.sql.includes('OR 1=1'));assert.ok(call.values[0].startsWith('%!%!_!!'));
});
test('Repo không đưa sort tùy ý vào SQL',async()=>{
 const pool=db();const repo=load('src/repositories/public-post-repository.js',{'../config/database':pool});
 await assert.rejects(()=>repo.findPublishedPage({q:'',sort:'title; DROP TABLE posts'}));assert.equal(pool.calls.length,0);
});
test('Danh sách quản lý AUTHOR giữ điều kiện tác giả, READER bị chặn trước SQL',async()=>{
 const pool=db();const service=load('src/services/list-service.js',{'../config/database':pool});
 await service.getPage('posts',{id:4,role:'AUTHOR'},{q:'Thử'});
 const query=pool.calls.find(c=>c.sql.includes('LIMIT ? OFFSET ?'));assert.match(query.sql,/p.author_id=\?/);assert.equal(query.values[0],'AUTHOR');assert.equal(query.values[1],4);
 const before=pool.calls.length;await assert.rejects(()=>service.getPage('posts',{id:5,role:'READER'},{}),e=>e.status===403);assert.equal(pool.calls.length,before);
});
test('Bộ lọc tác giả không mở quyền AUTHOR, trang sai không chạy SQL',async()=>{
 const pool=db();const service=load('src/services/list-service.js',{'../config/database':pool});
 await assert.rejects(()=>service.getPage('posts',{id:4,role:'AUTHOR'},{author_id:'3'}),e=>e.status===400);
 await assert.rejects(()=>service.getPage('users',{id:3,role:'ADMIN'},{page:'-1'}),e=>e.status===400);assert.equal(pool.calls.length,0);
});

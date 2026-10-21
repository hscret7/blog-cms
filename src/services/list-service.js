const pool=require('../config/database');
const {validatePostId}=require('../validators/post-validator');
function filters(query={}) {
  const page=query.page===undefined?'1':query.page;
  const q=query.q===undefined?'':query.q;
  const sort=query.sort===undefined?'newest':query.sort;
  if(!validatePostId(page).isValid || typeof q!=='string' || Array.from(q).length>100 || !['newest','oldest','title'].includes(sort)) {
    const e=new Error('Bộ lọc hoặc số trang không hợp lệ.');e.status=400;throw e;
  }
  return {page:Number(page),q:q.trim(),sort};
}
async function getPage(kind,actor,query={}) {
  const f=filters(query),values=[],terms=['1=1'];
  let from,select,columns,title;
  if(kind==='posts') {
    if(!['ADMIN','AUTHOR'].includes(actor.role)){const e=new Error('Bạn không có quyền quản lý bài viết.');e.status=403;throw e;}
    from='posts p JOIN users u ON u.id=p.author_id JOIN categories c ON c.id=p.category_id';
    select='p.id,p.title,p.slug,p.status,u.name author_name,c.name category_name';columns=['p.title'];title='p.title';
    terms.push("(?='ADMIN' OR p.author_id=?)");values.push(actor.role,actor.id);
    for(const [key,column] of [['category_id','p.category_id'],['author_id','p.author_id']])if(query[key]) {
      if(!validatePostId(query[key]).isValid || (key==='author_id' && actor.role!=='ADMIN')){const e=new Error('Bộ lọc tác giả/danh mục không hợp lệ.');e.status=400;throw e;}terms.push(column+'=?');values.push(Number(query[key]));
    }
  } else {
    if(actor.role!=='ADMIN'){const e=new Error('Bạn không có quyền quản trị.');e.status=403;throw e;}
    from=kind==='users'?'users p':'categories p';
    select=kind==='users'?'p.id,p.name,p.email,p.role,p.status':'p.id,p.name,p.slug,p.description';
    columns=kind==='users'?['p.name','p.email']:['p.name','p.slug'];title='p.name';
  }
  if(f.q) {terms.push('('+columns.map(col=>col+" LIKE ? ESCAPE '!'").join(' OR ')+')');values.push(...columns.map(()=>'%'+f.q.replace(/[!%_]/g,ch=>'!'+ch)+'%'));}
  if(query.status && kind!=='categories') {
    const allowed=kind==='posts'?['DRAFT','PUBLISHED']:['ACTIVE','LOCKED'];
    if(!allowed.includes(query.status)){const e=new Error('Trạng thái không hợp lệ.');e.status=400;throw e;}terms.push('p.status=?');values.push(query.status);
  }
  if(query.role && kind==='users') {
    if(!['READER','AUTHOR','ADMIN'].includes(query.role)){const e=new Error('Vai trò không hợp lệ.');e.status=400;throw e;}terms.push('p.role=?');values.push(query.role);
  }
  const where=terms.join(' AND ');
  const [counts]=await pool.execute('SELECT COUNT(*) total FROM '+from+' WHERE '+where,values);
  const total=Number(counts[0].total),totalPages=Math.max(1,Math.ceil(total/20));f.page=Math.min(f.page,totalPages);
  const order=f.sort==='title'?title+' ASC,p.id DESC': 'p.id '+(f.sort==='oldest'?'ASC':'DESC');
  const [rows]=await pool.execute('SELECT '+select+' FROM '+from+' WHERE '+where+' ORDER BY '+order+' LIMIT ? OFFSET ?',[...values,20,(f.page-1)*20]);
  const link=page=>{const params=new URLSearchParams();for(const [key,value]of Object.entries(query))if(typeof value==='string'&&key!=='page')params.set(key,value);params.set('page',page);return '?'+params;};
  let categoryOptions = [], authorOptions = [];
  if (kind === 'posts') {
    [categoryOptions] = await pool.execute('SELECT id,name FROM categories ORDER BY name,id');
    if (actor.role === 'ADMIN') [authorOptions] = await pool.execute('SELECT DISTINCT u.id,u.name FROM users u JOIN posts p ON p.author_id=u.id ORDER BY u.name,u.id');
  }
  return {categoryOptions,authorOptions,rows,total,totalPages,page:f.page,filters:f,query,previousUrl:f.page>1?link(f.page-1):null,nextUrl:f.page<totalPages?link(f.page+1):null};
}
module.exports={filters,getPage};

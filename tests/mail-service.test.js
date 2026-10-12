const assert=require('node:assert/strict');
const test=require('node:test');
const {load}=require('./helpers/load-module');
const deliveries=[];
const {createMailService}=load('src/services/mail-service.js',{nodemailer:{createTransport(options){return{async sendMail(message){deliveries.push({options,message});}};}}});
const env={PUBLIC_BASE_URL:'http://localhost:18090',SMTP_HOST:'smtp.example.invalid',SMTP_PORT:'587',SMTP_USER:'test',SMTP_PASSWORD:'TEST_ONLY',SMTP_FROM:'noreply@example.invalid'};
test('Email dùng token ở fragment và SMTP STARTTLS; không có URL token dạng query',async()=>{
 const mail=createMailService(env);await mail.sendToken('reader@example.invalid','RESET_PASSWORD','a'.repeat(64));
 const {options,message}=deliveries.at(-1);assert.equal(options.requireTLS,true);assert.equal(options.debug,false);assert.equal(options.disableFileAccess,true);
 assert.match(message.text,/reset-password#token=/);assert.ok(!message.text.includes('?token='));
});
test('Từ chối origin HTTP công khai hoặc origin có credentials/path',()=>{
 for(const PUBLIC_BASE_URL of ['http://example.org','https://user:secret@example.org','https://example.org/path','https://example.org/?token=x'])assert.throws(()=>createMailService({...env,PUBLIC_BASE_URL}).assertConfigured());
 assert.doesNotThrow(()=>createMailService({...env,PUBLIC_BASE_URL:'https://blog.example.org'}).assertConfigured());
});

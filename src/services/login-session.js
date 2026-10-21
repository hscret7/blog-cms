const {getCsrfToken}=require('../middlewares/csrf');
async function establish(req,user) {
  await new Promise((resolve,reject)=>req.session.regenerate(error=>error?reject(error):resolve()));
  req.session.userId=user.id;req.session.authVersion=user.session_version;getCsrfToken(req);
  await new Promise((resolve,reject)=>req.session.save(error=>error?reject(error):resolve()));
}
module.exports={establish};

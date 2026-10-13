'use strict';
window.completeGoogleSignIn=async function(response){
 const output=document.getElementById('google-result');output.textContent='Đang xác minh Google…';
 try{const result=await fetch('/auth/google/complete',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:response.credential,_csrf:document.getElementById('google-csrf').value})});
  const data=await result.json();if(result.ok&&['/account','/account/google'].includes(data.redirect)){location.assign(data.redirect);return;}
  output.textContent=data.message||'Không đăng nhập được. Hãy tải lại trang.';
 }catch{output.textContent='Không kết nối được với website. Hãy tải lại trang và thử lại.';}
};

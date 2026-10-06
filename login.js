document.getElementById('f').onsubmit=async e=>{
  e.preventDefault();
  const b=document.getElementById('b'),err=document.getElementById('err');
  b.disabled=true;err.textContent='';
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:u.value.trim(),password:p.value})});
    const d=await r.json().catch(()=>({}));
    if(r.ok){location.href='/';return}
    err.textContent=d.error||'Đăng nhập thất bại';
  }catch{err.textContent='Không kết nối được máy chủ'}
  p.value='';b.disabled=false;
};

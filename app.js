let db={mats:[],entries:[],hist:[]},CSRF='';
async function logout(){await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':CSRF}}).catch(()=>{});location.href='/login'}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const $=id=>document.getElementById(id);
const fmt=n=>(+n||0).toLocaleString('vi-VN');
const pad=n=>String(n).padStart(2,'0');
const toLocalISO=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const show=iso=>{const d=new Date(iso);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const matName=id=>(db.mats.find(m=>m.id===id)||{name:'(đã xóa)'}).name;

function setMode(){
  const m=$('fMode').value,now=new Date();
  const w=$('fWrap');
  if(m==='day')w.innerHTML=`<input type="date" id="fVal" value="${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}" onchange="render()">`;
  else if(m==='month')w.innerHTML=`<input type="month" id="fVal" value="${now.getFullYear()}-${pad(now.getMonth()+1)}" onchange="render()">`;
  else if(m==='year')w.innerHTML=`<input type="number" id="fVal" value="${now.getFullYear()}" min="2000" max="2100" onchange="render()">`;
  else w.innerHTML='<input disabled value="—">';
  render();
}
function filtered(){
  const m=$('fMode').value,v=$('fVal')?.value||'';
  return db.entries.filter(e=>{
    const k=e.time; // YYYY-MM-DDTHH:mm
    if(m==='day')return k.startsWith(v);
    if(m==='month')return k.startsWith(v);
    if(m==='year')return k.startsWith(v+'-');
    return true;
  }).sort((a,b)=>b.time.localeCompare(a.time));
}
function periodLabel(){
  const m=$('fMode').value,v=$('fVal')?.value||'';
  if(m==='day'){const[y,mo,d]=v.split('-');return `Ngày ${d}-${mo}-${y}`}
  if(m==='month'){const[y,mo]=v.split('-');return `Tháng ${mo}-${y}`}
  if(m==='year')return `Năm ${v}`;
  return 'Tất cả';
}
function summarize(list){
  const g={};let chi=0,thu=0,qty=0;
  list.forEach(e=>{
    const t=e.qty*e.price;
    g[e.matId]=g[e.matId]||{name:matName(e.matId),qi:0,ci:0,qo:0,co:0};
    if(e.type==='in'){g[e.matId].qi+=e.qty;g[e.matId].ci+=t;chi+=t;qty+=e.qty}
    else{g[e.matId].qo+=e.qty;g[e.matId].co+=t;thu+=t}
  });
  return{g:Object.values(g),chi,thu,qty};
}
function render(){
  // material select
  const sel=$('eMat'),cur=sel.value;
  sel.innerHTML=db.mats.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');
  if(cur&&db.mats.some(m=>m.id===cur))sel.value=cur;
  fillPrice();
  // materials table
  $('mBody').innerHTML=db.mats.map(m=>`<tr><td>${esc(m.name)}</td>
   <td class="n"><input type="number" min="0" step="any" value="${m.price}" style="width:110px" id="p_${m.id}"> <button onclick="updPrice('${m.id}')">Cập nhật</button></td>
   <td><button class="del" onclick="delMat('${m.id}')">Xóa</button></td></tr>`).join('')||'<tr><td colspan=3>Chưa có vật liệu</td></tr>';
  $('hBody').innerHTML=[...db.hist].reverse().map(h=>`<tr><td>${show(h.time)}</td><td>${esc(matName(h.matId))}</td><td class="n">${h.old==null?'—':fmt(h.old)}</td><td class="n">${fmt(h.new)}</td></tr>`).join('')||'<tr><td colspan=4>Chưa có</td></tr>';
  // entries
  const list=filtered(),s=summarize(list);
  const rowHtml = e => `<tr><td>${show(e.time)}</td><td>${esc(matName(e.matId))}</td>
   <td class="n">${fmt(e.price)}</td><td class="n">${fmt(e.qty)}</td><td class="n">${fmt(e.qty*e.price)}</td><td>${esc(e.note)}</td>
   <td><button class="del" onclick="delEntry('${e.id}')">Xóa</button></td></tr>`;
  const inList = list.filter(e => e.type === 'in'), outList = list.filter(e => e.type === 'out');
  $('eBodyIn').innerHTML = inList.map(rowHtml).join('') || '<tr><td colspan=7>Không có dữ liệu</td></tr>';
  $('eBodyOut').innerHTML = outList.map(rowHtml).join('') || '<tr><td colspan=7>Không có dữ liệu</td></tr>';
  $('gBody').innerHTML=s.g.map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${fmt(x.qi)}</td><td class="n">${fmt(x.ci)}</td><td class="n">${fmt(x.qo)}</td><td class="n">${fmt(x.co)}</td></tr>`).join('')||'<tr><td colspan=5>Không có dữ liệu</td></tr>';
  $('sChi').textContent=fmt(s.chi)+' đ';$('sThu').textContent=fmt(s.thu)+' đ';
  $('sNet').textContent=fmt(s.thu-s.chi)+' đ';$('sQty').textContent=fmt(s.qty)+' kg';

  // stock
  const stock = {};
  db.mats.forEach(m => stock[m.id] = { name: m.name, in: 0, out: 0, net: 0 });
  db.entries.forEach(e => {
    if (!stock[e.matId]) stock[e.matId] = { name: matName(e.matId), in: 0, out: 0, net: 0 };
    if (e.type === 'in') { stock[e.matId].in += e.qty; stock[e.matId].net += e.qty; }
    else { stock[e.matId].out += e.qty; stock[e.matId].net -= e.qty; }
  });
  $('stockBody').innerHTML = Object.values(stock).map((s, i) => `<tr><td>${i+1}</td><td>${esc(s.name)}</td><td class="n">${fmt(s.in)}</td><td class="n">${fmt(s.out)}</td><td class="n" style="font-weight:bold; color:${s.net < 0 ? 'red' : 'inherit'}">${fmt(s.net)}</td></tr>`).join('') || '<tr><td colspan=5>Chưa có dữ liệu</td></tr>';

}
function fillPrice(){
  const m=db.mats.find(x=>x.id===$('eMat').value);
  $('ePrice').value=m?m.price:'';calc();
}
function calc(){$('eTotal').value=fmt((+$('ePrice').value||0)*(+$('eQty').value||0))+' đ'}
async function reload(){db=await api('GET','/api/data');render()}
async function run(fn){try{await fn();await reload()}catch(e){if(e)alert(e.message)}}
function addMat(){
  const name=$('mName').value.trim(),price=+$('mPrice').value;
  if(!name)return alert('Nhập tên vật liệu');
  run(async()=>{await api('POST','/api/materials',{name,price});$('mName').value='';$('mPrice').value=''});
}
function updPrice(id){
  const m=db.mats.find(x=>x.id===id),p=+$('p_'+id).value;
  if(p===m.price)return;
  run(()=>api('PUT','/api/materials/'+id,{price:p}));
}
function delMat(id){
  if(db.entries.some(e=>e.matId===id))return alert('Vật liệu đã có phiếu, không thể xóa');
  if(!confirm('Xóa vật liệu?'))return;
  run(()=>api('DELETE','/api/materials/'+id));
}
function addEntry(){
  const matId=$('eMat').value,qty=+$('eQty').value,price=+$('ePrice').value,time=$('eTime').value;
  if(!matId)return alert('Hãy thêm vật liệu trước');
  if(!(qty>0))return alert('Nhập khối lượng');
  if(!time)return alert('Chọn ngày giờ');
  run(async()=>{
    await api('POST','/api/entries',{type:$('eType').value,time,matId,price,qty,note:$('eNote').value.trim()});
    $('eQty').value='';$('eNote').value='';$('eTime').value=toLocalISO(new Date());
  });
}
function delEntry(id){if(confirm('Xóa phiếu này?'))run(()=>api('DELETE','/api/entries/'+id))}


$('eMat').onchange=fillPrice;$('ePrice').oninput=calc;$('eQty').oninput=calc;
let ME={user:'',role:'user'};
function showTab(id){
  if(id==='tabUsers'&&ME.role!=='admin')id='tabEntry';
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active',s.id===id));
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  localStorage.setItem('phelieu_tab',id);
  if(id==='tabUsers')loadUsersUI();else render();
}
async function api(method,url,data){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:data?JSON.stringify(data):undefined});
  if(r.status===401){location.href='/login';throw 0}
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Lỗi');
  return d;
}
async function loadUsersUI(){
  try{
    const list=await api('GET','/api/users');
    $('uBody').innerHTML=list.map(u=>`<tr><td>${esc(u.username)}${u.username===ME.user?' (bạn)':''}</td>
     <td>${u.role==='admin'?'Quản trị':'Nhân viên'}</td><td>${u.created?show(u.created.slice(0,16)):''}</td>
     <td><button onclick="resetPw('${esc(u.username)}')">Đổi mật khẩu</button>
     ${u.username===ME.user?'':` <button class="del" onclick="delUser('${esc(u.username)}')">Xóa</button>`}</td></tr>`).join('');
  }catch(e){if(e)alert(e.message)}
}
async function addUser(){
  try{
    await api('POST','/api/users',{username:$('uName').value.trim(),password:$('uPass').value,role:$('uRole').value});
    $('uName').value='';$('uPass').value='';loadUsersUI();
  }catch(e){if(e)alert(e.message)}
}
async function delUser(n){
  if(!confirm('Xóa tài khoản '+n+'?'))return;
  try{await api('DELETE','/api/users/'+encodeURIComponent(n));loadUsersUI()}catch(e){if(e)alert(e.message)}
}
async function resetPw(n){
  const p=prompt('Mật khẩu mới cho '+n+' (≥ 12 ký tự):');
  if(!p)return;
  try{await api('POST','/api/users/'+encodeURIComponent(n)+'/password',{password:p});alert('Đã đổi mật khẩu')}catch(e){if(e)alert(e.message)}
}
$('eTime').value=toLocalISO(new Date());
(async()=>{
  const me=await fetch('/api/me');
  if(!me.ok){location.href='/login';return}
  const m=await me.json();CSRF=m.csrf;ME=m;
  $('who').textContent='👤 '+m.user+(m.role==='admin'?' (quản trị)':'');
  if(m.role==='admin') {
      $('navUsers').style.display='';
    } else {
      document.querySelector('[data-tab="tabReport"]').style.display='none';
      document.querySelector('[data-tab="tabMat"]').style.display='none';
      document.querySelector('[data-tab="tabStock"]').style.display='none';
      const excelDiv = document.querySelector('#tabEntry .row:nth-child(2)');
      if (excelDiv) excelDiv.style.display = 'none';
      $('ePrice').disabled = true;
      $('eTime').disabled = true;
    }
    try{db=await api('GET','/api/data')}catch(e){if(e)alert(e.message);return}
    setMode();
    showTab(m.role==='admin' ? (localStorage.getItem('phelieu_tab')||'tabEntry') : 'tabEntry');
})();

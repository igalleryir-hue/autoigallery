const adminTokenKey = 'igallery_admin_token';
const userTokenKey = 'igallery_user_token';
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('fa-IR');
const money = n => fmt(n) + ' تومان';
const setMsg = (id, text) => { const el = $(id); if (el) el.textContent = text || ''; };
const adminToken = () => localStorage.getItem(adminTokenKey);
const userToken = () => localStorage.getItem(userTokenKey);

function carCard(car, mine=false){
  const usage = Number(car.mileage || 0) <= 1000 ? 'صفر' : 'کارکرده';
  const isPublic = !car.status || car.status === 'approved';
  return `<article class="productCard">
    <button class="thumb productThumb" ${isPublic ? `onclick="showCar(${car.id})"` : ''} aria-label="مشاهده ${escapeHtml(car.title)}">${car.image ? `<img src="${car.image}" alt="${escapeHtml(car.title)}">` : '<span>بدون تصویر</span>'}</button>
    <div class="productBody">
      <button class="titleBtn" ${isPublic ? `onclick="showCar(${car.id})"` : ''}><h3>${escapeHtml(car.title)}</h3></button>
      ${car.status && car.status !== 'approved' ? `<span class="statusBadge ${car.status}">${statusText(car.status)}</span>` : ''}
      <div class="productSpecs">
        <span>برند: ${escapeHtml(car.brand)}</span>
        <span>مدل: ${escapeHtml(car.model)}</span>
        <span>سال: ${fmt(car.year)}</span>
        <span>${usage}</span>
      </div>
      <div class="productPrice">${money(car.price)}</div>
      <p>${escapeHtml(car.description || '').slice(0, 110)}${(car.description || '').length > 110 ? '...' : ''}</p>
      <div class="cardActions">
        ${isPublic ? `<button class="btn small" onclick="showCar(${car.id})">مشاهده جزئیات</button><a class="btn ghost small" href="tel:${car.seller_phone}">تماس</a>` : `<span class="msg">${statusText(car.status)}</span>`}
        ${mine ? `<button class="btn ghost small" onclick="adminDeleteCar(${car.id})">حذف</button>` : ''}
      </div>
    </div>
  </article>`;
}
function escapeHtml(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function statusText(status){ return status === 'pending' ? 'در انتظار تایید' : status === 'rejected' ? 'رد شده' : 'تایید شده'; }
function selectedUsage(){ return document.querySelector('input[name="usage"]:checked')?.value || ''; }
function buildActiveFilters(){
  const chips=[];
  const q=$('q')?.value?.trim(); const brand=$('brand')?.value; const min=$('minPrice')?.value; const max=$('maxPrice')?.value; const usage=selectedUsage();
  if(q) chips.push(`جستجو: ${escapeHtml(q)}`);
  if(brand) chips.push(`برند: ${escapeHtml(brand)}`);
  if(min) chips.push(`از ${fmt(min)} تومان`);
  if(max) chips.push(`تا ${fmt(max)} تومان`);
  if(usage==='zero') chips.push('خودرو صفر');
  if(usage==='used') chips.push('خودرو کارکرده');
  if($('pricedOnly')?.checked) chips.push('قیمت‌دار');
  if($('activeFilters')) $('activeFilters').innerHTML = chips.map(c=>`<span>${c}</span>`).join('');
}
async function loadCars(){
  if(!$('carsGrid')) return;
  const q = $('q')?.value || '';
  const brand = $('brand')?.value || '';
  const sort = $('sort')?.value || 'new';
  const minPrice = $('minPrice')?.value || 0;
  const maxPrice = $('maxPrice')?.value || 999999999999;
  const params = new URLSearchParams({ q, brand, sort, minPrice, maxPrice });
  let cars = await (await fetch('/api/cars?' + params)).json();
  const usage = selectedUsage();
  if($('pricedOnly')?.checked) cars = cars.filter(c => Number(c.price || 0) > 0);
  if(usage === 'zero') cars = cars.filter(c => Number(c.mileage || 0) <= 1000);
  if(usage === 'used') cars = cars.filter(c => Number(c.mileage || 0) > 1000);
  if($('count')) $('count').textContent = fmt(cars.length) + ' خودرو';
  buildActiveFilters();
  $('carsGrid').innerHTML = cars.map(c => carCard(c)).join('') || '<p class="msg emptyMsg">فعلاً خودرویی مطابق فیلتر شما ثبت نشده است.</p>';
}
function resetFilters(){
  ['q','brand','minPrice','maxPrice'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('pricedOnly')) $('pricedOnly').checked=false;
  const all=document.querySelector('input[name="usage"][value=""]'); if(all) all.checked=true;
  if($('sort')) $('sort').value='new';
  loadCars();
}
async function showCar(id){
  const car = await (await fetch('/api/cars/' + id)).json();
  const usage = Number(car.mileage || 0) <= 1000 ? 'صفر' : 'کارکرده';
  $('modalContent').innerHTML = `<div class="detailLayout">
    <div class="detailImage">${car.image ? `<img src="${car.image}" alt="${escapeHtml(car.title)}">` : '<span>بدون تصویر</span>'}</div>
    <div class="detailInfo">
      <div class="breadcrumbMini">خانه / همه خودروها / ${escapeHtml(car.title)}</div>
      <h2>${escapeHtml(car.title)}</h2>
      <div class="detailPrice">${money(car.price)}</div>
      <div class="detailSpecs">
        <div><span>برند</span><strong>${escapeHtml(car.brand)}</strong></div>
        <div><span>مدل</span><strong>${escapeHtml(car.model)}</strong></div>
        <div><span>سال</span><strong>${fmt(car.year)}</strong></div>
        <div><span>کارکرد</span><strong>${fmt(car.mileage)} کیلومتر</strong></div>
        <div><span>وضعیت</span><strong>${usage}</strong></div>
        <div><span>رنگ</span><strong>${escapeHtml(car.color || 'ثبت نشده')}</strong></div>
        <div><span>گیربکس</span><strong>${escapeHtml(car.transmission || 'ثبت نشده')}</strong></div>
        <div><span>سوخت</span><strong>${escapeHtml(car.fuel || 'ثبت نشده')}</strong></div>
      </div>
      <h3>توضیحات</h3>
      <p class="detailDesc">${escapeHtml(car.description || 'توضیحاتی برای این خودرو ثبت نشده است.')}</p>
      <div class="safeBox">
        <strong>هشدار امنیتی</strong>
        <p>پیش از هرگونه پرداخت، خودرو و مدارک را حضوری بررسی کنید. مسئولیت معامله و پرداخت برعهده خریدار و فروشنده است.</p>
      </div>
      <div class="detailActions">
        <a class="btn" href="tel:${car.seller_phone}">تماس با iGallery</a>
        <button class="btn ghost" onclick="copyPhone('${escapeHtml(car.seller_phone)}')">کپی شماره</button>
      </div>
    </div>
  </div>`;
  $('carModal').classList.remove('hidden');
}
function hideCarModal(){ if($('carModal')) $('carModal').classList.add('hidden'); }
function closeCarModal(e){ if(e.target?.id === 'carModal') hideCarModal(); }
function copyPhone(phone){ navigator.clipboard?.writeText(phone); alert('شماره تماس کپی شد: ' + phone); }

// Admin panel
async function adminLogin(){
  setMsg('adminAuthMsg', '');
  const res = await fetch('/api/admin/login', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ phone: $('adminPhone').value, password: $('adminPassword').value })
  });
  const data = await res.json();
  if(!res.ok) return setMsg('adminAuthMsg', data.error || 'خطا در ورود.');
  localStorage.setItem(adminTokenKey, data.token);
  adminInit();
}
function adminLogout(){ localStorage.removeItem(adminTokenKey); adminInit(); }
function adminHeaders(){ return { Authorization: 'Bearer ' + adminToken() }; }
async function adminInit(){
  if(!$('adminLoginBox')) return;
  const logged = !!adminToken();
  $('adminLoginBox').classList.toggle('hidden', logged);
  $('adminApp').classList.toggle('hidden', !logged);
  $('adminLogout').classList.toggle('hidden', !logged);
  if(logged){ await adminLoadStats(); await adminLoadPendingCars(); await adminLoadCars(); await adminLoadLeads(); await adminLoadUsers(); }
}
async function adminLoadStats(){
  const res = await fetch('/api/admin/stats', { headers: adminHeaders() });
  if(!res.ok) return adminLogout();
  const s = await res.json();
  $('statCars').textContent = fmt(s.approvedCars ?? s.cars);
  if($('statPending')) $('statPending').textContent = fmt(s.pendingCars || 0);
  $('statLeads').textContent = fmt(s.leads);
  $('statUsers').textContent = fmt(s.users);
}
async function adminLoadCars(){
  const res = await fetch('/api/admin/cars', { headers: adminHeaders() });
  const cars = await res.json();
  $('adminCars').innerHTML = cars.map(c => carCard(c, true)).join('') || '<p class="msg">هنوز خودرویی ثبت نشده است.</p>';
  adminLoadStats();
}
async function adminLoadPendingCars(){
  if(!$('adminPendingCars')) return;
  const res = await fetch('/api/admin/pending-cars', { headers: adminHeaders() });
  const cars = await res.json();
  $('adminPendingCars').innerHTML = cars.map(c => pendingCarCard(c)).join('') || '<p class="msg">آگهی در انتظار تایید وجود ندارد.</p>';
}
function pendingCarCard(car){
  return `<article class="productCard pendingReviewCard">
    <div class="thumb productThumb">${car.image ? `<img src="${car.image}" alt="${escapeHtml(car.title)}">` : '<span>بدون تصویر</span>'}</div>
    <div class="productBody">
      <span class="statusBadge pending">در انتظار تایید</span>
      <h3>${escapeHtml(car.title)}</h3>
      <div class="productSpecs">
        <span>برند: ${escapeHtml(car.brand)}</span><span>مدل: ${escapeHtml(car.model)}</span><span>سال: ${fmt(car.year)}</span><span>کارکرد: ${fmt(car.mileage)} کیلومتر</span>
      </div>
      <div class="productPrice">${money(car.price)}</div>
      <p>${escapeHtml(car.description || '').slice(0, 120)}</p>
      <div class="safeBox miniSafe"><strong>فروشنده</strong><p>${escapeHtml(car.seller_name)} - ${escapeHtml(car.seller_phone)}</p></div>
      <div class="cardActions">
        <button class="btn small" onclick="adminSetCarStatus(${car.id}, 'approved')">تایید و انتشار</button>
        <button class="btn ghost small" onclick="adminSetCarStatus(${car.id}, 'rejected')">رد کردن</button>
        <button class="btn ghost small" onclick="adminDeleteCar(${car.id})">حذف</button>
      </div>
    </div>
  </article>`;
}
async function adminSetCarStatus(id, status){
  await fetch('/api/admin/cars/' + id + '/status', { method:'PATCH', headers:{ ...adminHeaders(), 'Content-Type':'application/json' }, body: JSON.stringify({ status }) });
  await adminLoadPendingCars();
  await adminLoadCars();
  await adminLoadStats();
}
async function adminLoadLeads(){
  const res = await fetch('/api/admin/leads', { headers: adminHeaders() });
  const leads = await res.json();
  $('adminLeads').innerHTML = leads.map(l => rowItem(`${l.first_name} ${l.last_name}`, l.phone, l.created_at)).join('') || '<p class="msg">ثبت‌نامی خرید وجود ندارد.</p>';
}
async function adminLoadUsers(){
  const res = await fetch('/api/admin/users', { headers: adminHeaders() });
  const users = await res.json();
  $('adminUsers').innerHTML = users.map(u => rowItem(`${u.first_name} ${u.last_name}`, u.phone, u.created_at)).join('') || '<p class="msg">هنوز کاربری وارد سایت نشده است.</p>';
}
function rowItem(title, phone, date){
  return `<article class="rowItem"><div><strong>${escapeHtml(title)}</strong><small>${new Date(date).toLocaleString('fa-IR')}</small></div><a href="tel:${phone}">${escapeHtml(phone)}</a></article>`;
}
async function adminDeleteCar(id){
  if(!confirm('این خودرو حذف شود؟')) return;
  await fetch('/api/admin/cars/' + id, { method:'DELETE', headers: adminHeaders() });
  adminLoadCars();
  adminLoadPendingCars();
}
if($('adminCarForm')){
  $('adminCarForm').addEventListener('submit', async e => {
    e.preventDefault(); setMsg('adminFormMsg','');
    const fd = new FormData(e.target);
    const res = await fetch('/api/admin/cars', { method:'POST', headers: adminHeaders(), body: fd });
    const data = await res.json();
    if(!res.ok) return setMsg('adminFormMsg', data.error || 'خطا در ثبت خودرو.');
    e.target.reset(); setMsg('adminFormMsg', data.message || 'خودرو ثبت شد.'); adminLoadCars();
  });
}

// User panel
async function requestRegisterOtp(){
  setMsg('userRegisterMsg','');
  const payload = {
    purpose: 'register',
    first_name: $('userFirstName').value,
    last_name: $('userLastName').value,
    phone: $('userRegisterPhone').value
  };
  const res = await fetch('/api/user/request-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  const data = await res.json();
  if(!res.ok) return setMsg('userRegisterMsg', data.error || 'ارسال کد انجام نشد.');
  $('registerOtpBox')?.classList.remove('hidden');
  setMsg('userRegisterMsg', data.devCode ? `${data.message} کد تست: ${data.devCode}` : data.message);
}
async function verifyRegisterOtp(){
  setMsg('userRegisterMsg','');
  const payload = { phone: $('userRegisterPhone').value, code: $('userRegisterOtp').value };
  const res = await fetch('/api/user/verify-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  const data = await res.json();
  if(!res.ok) return setMsg('userRegisterMsg', data.error || 'کد تایید معتبر نیست.');
  localStorage.setItem(userTokenKey, data.token);
  userInit();
}
async function requestLoginOtp(){
  setMsg('userLoginMsg','');
  const res = await fetch('/api/user/request-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ purpose:'login', phone:$('userLoginPhone').value }) });
  const data = await res.json();
  if(!res.ok) return setMsg('userLoginMsg', data.error || 'ابتدا ثبت‌نام کنید.');
  $('loginOtpBox')?.classList.remove('hidden');
  setMsg('userLoginMsg', data.devCode ? `${data.message} کد تست: ${data.devCode}` : data.message);
}
async function verifyLoginOtp(){
  setMsg('userLoginMsg','');
  const res = await fetch('/api/user/verify-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone:$('userLoginPhone').value, code:$('userLoginOtp').value }) });
  const data = await res.json();
  if(!res.ok) return setMsg('userLoginMsg', data.error || 'کد تایید معتبر نیست.');
  localStorage.setItem(userTokenKey, data.token);
  userInit();
}
// سازگاری با نام‌های قبلی
const userRegister = requestRegisterOtp;
const userLogin = requestLoginOtp;
function userLogout(){ localStorage.removeItem(userTokenKey); userInit(); }
async function userInit(){
  if(!$('userAuthBox')) return;
  const logged = !!userToken();
  $('userAuthBox').classList.toggle('hidden', logged);
  $('userApp').classList.toggle('hidden', !logged);
  $('userLogout').classList.toggle('hidden', !logged);
  if(!logged) return;
  const meRes = await fetch('/api/user/me', { headers:{ Authorization:'Bearer ' + userToken() } });
  if(!meRes.ok){ localStorage.removeItem(userTokenKey); return userInit(); }
  const me = await meRes.json();
  $('userWelcome').textContent = `${me.first_name} ${me.last_name} عزیز، خوش آمدید`;
  const cars = await (await fetch('/api/cars')).json();
  $('userCount').textContent = fmt(cars.length) + ' خودرو';
  $('userCars').innerHTML = cars.map(c => carCard(c)).join('') || '<p class="msg">فعلاً خودرویی ثبت نشده است.</p>';
  await userLoadMyAds();
}
async function userLoadMyAds(){
  if(!$('userMyAds')) return;
  const res = await fetch('/api/user/cars', { headers:{ Authorization:'Bearer ' + userToken() } });
  if(!res.ok) return;
  const cars = await res.json();
  $('userMyAds').innerHTML = cars.map(c => carCard(c)).join('') || '<p class="msg">هنوز آگهی‌ای ثبت نکرده‌اید.</p>';
}
if($('userCarForm')){
  $('userCarForm').addEventListener('submit', async e => {
    e.preventDefault(); setMsg('userCarMsg','');
    const fd = new FormData(e.target);
    const res = await fetch('/api/user/cars', { method:'POST', headers:{ Authorization:'Bearer ' + userToken() }, body: fd });
    const data = await res.json();
    if(!res.ok) return setMsg('userCarMsg', data.error || 'خطا در ثبت آگهی.');
    e.target.reset(); setMsg('userCarMsg', data.message || 'آگهی ثبت شد و در انتظار تایید مدیر است.');
    await userLoadMyAds();
  });
}

loadCars();
adminInit();
userInit();

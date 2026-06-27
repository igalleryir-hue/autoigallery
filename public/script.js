const adminTokenKey = 'igallery_admin_token';
const userTokenKey = 'igallery_user_token';
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('fa-IR');
const money = n => fmt(n) + ' تومان';
const setMsg = (id, text) => { const el = $(id); if (el) el.textContent = text || ''; };
const adminToken = () => localStorage.getItem(adminTokenKey);
const userToken = () => localStorage.getItem(userTokenKey);

function dealBadge(car){
  const mileage = Number(car.mileage || 0);
  const year = Number(car.year || 0);
  const body = String(car.body_status || '');
  if (body.includes('بدون') && mileage <= 30000) return 'گزینه تمیز';
  if (year >= 1402 || year >= 2023) return 'مدل بالا';
  if (mileage <= 1000) return 'صفر / کم‌کارکرد';
  return 'قیمت قابل بررسی';
}
function carCard(car, mine=false){
  const usage = Number(car.mileage || 0) <= 1000 ? 'صفر' : 'کارکرده';
  const isPublic = !car.status || car.status === 'approved';
  const approved = isPublic ? '<span class="verifiedPill">تایید شده</span>' : '';
  const transmission = car.transmission ? `<span>${escapeHtml(car.transmission)}</span>` : '';
  return `<article class="productCard upgradedCarCard">
    <button class="thumb productThumb" ${isPublic ? `onclick="showCar(${car.id})"` : ''} aria-label="مشاهده ${escapeHtml(car.title)}">
      ${car.image ? `<img src="${car.image}" alt="${escapeHtml(car.title)}">` : '<span class="noImageMark">iGallery</span>'}
      <span class="dealBadge">${dealBadge(car)}</span>
      ${approved}
    </button>
    <div class="productBody">
      ${car.status && car.status !== 'approved' ? `<span class="statusBadge ${car.status}">${statusText(car.status)}</span>` : ''}
      <button class="titleBtn" ${isPublic ? `onclick="showCar(${car.id})"` : ''}><h3>${escapeHtml(car.title)}</h3></button>
      <div class="productSpecs">
        <span>برند: ${escapeHtml(car.brand)}</span>
        <span>مدل: ${escapeHtml(car.model)}</span>
        <span>سال: ${fmt(car.year)}</span>
        <span>${usage}</span>
        ${transmission}
      </div>
      <div class="priceRow">
        <div class="productPrice">${money(car.price)}</div>
        <small>مشاوره قیمت قبل از معامله</small>
      </div>
      <p>${escapeHtml(car.description || 'برای دریافت جزئیات بیشتر با نمایشگاه تماس بگیرید.').slice(0, 120)}${(car.description || '').length > 120 ? '...' : ''}</p>
      <div class="cardTrustRow"><span>بررسی مدارک</span><span>امکان معاوضه</span><span>تماس سریع</span></div>
      <div class="cardActions">
        ${isPublic ? `<button class="btn small" onclick="showCar(${car.id})">جزئیات و تماس</button><a class="btn ghost small" href="tel:${car.seller_phone}">تماس</a>` : `<span class="msg">${statusText(car.status)}</span>`}
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
  const minYear=$('minYear')?.value; const maxYear=$('maxYear')?.value; const maxMileage=$('maxMileage')?.value; const transmission=$('transmission')?.value; const bodyStatus=$('bodyStatus')?.value;
  if(q) chips.push(`جستجو: ${escapeHtml(q)}`);
  if(brand) chips.push(`برند: ${escapeHtml(brand)}`);
  if(min) chips.push(`از ${fmt(min)} تومان`);
  if(max && Number(max) < 999999999999) chips.push(`تا ${fmt(max)} تومان`);
  if(minYear) chips.push(`از سال ${fmt(minYear)}`);
  if(maxYear) chips.push(`تا سال ${fmt(maxYear)}`);
  if(maxMileage) chips.push(`کارکرد تا ${fmt(maxMileage)} کیلومتر`);
  if(transmission) chips.push(`گیربکس: ${escapeHtml(transmission)}`);
  if(bodyStatus) chips.push(`بدنه: ${escapeHtml(bodyStatus)}`);
  if(usage==='zero') chips.push('صفر یا کم‌کارکرد');
  if(usage==='used') chips.push('کارکرده');
  if($('pricedOnly')?.checked) chips.push('قیمت‌دار');
  if($('activeFilters')) $('activeFilters').innerHTML = chips.map(c=>`<span>${c}</span>`).join('');
}
function applyLocalFilters(cars){
  const usage = selectedUsage();
  const minYear = Number($('minYear')?.value || 0);
  const maxYear = Number($('maxYear')?.value || 9999);
  const maxMileage = Number($('maxMileage')?.value || 999999999);
  const transmission = $('transmission')?.value || '';
  const bodyStatus = $('bodyStatus')?.value || '';
  if($('pricedOnly')?.checked) cars = cars.filter(c => Number(c.price || 0) > 0);
  if(usage === 'zero') cars = cars.filter(c => Number(c.mileage || 0) <= 1000);
  if(usage === 'used') cars = cars.filter(c => Number(c.mileage || 0) > 1000);
  if(minYear) cars = cars.filter(c => Number(c.year || 0) >= minYear);
  if(maxYear < 9999) cars = cars.filter(c => Number(c.year || 0) <= maxYear);
  if(maxMileage < 999999999) cars = cars.filter(c => Number(c.mileage || 0) <= maxMileage);
  if(transmission) cars = cars.filter(c => String(c.transmission || '').includes(transmission));
  if(bodyStatus) cars = cars.filter(c => String(c.body_status || '').includes(bodyStatus));
  return cars;
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
  cars = applyLocalFilters(cars);
  if($('count')) $('count').textContent = fmt(cars.length) + ' خودرو';
  buildActiveFilters();
  $('carsGrid').innerHTML = cars.map(c => carCard(c)).join('') || '<p class="msg emptyMsg">فعلاً خودرویی مطابق فیلتر شما ثبت نشده است. با نمایشگاه تماس بگیرید تا گزینه مناسب را معرفی کنیم.</p>';
}
function setBudget(min, max){
  if($('minPrice')) $('minPrice').value = min || '';
  if($('maxPrice')) $('maxPrice').value = max >= 999999999999 ? '' : max;
  loadCars();
}
function resetFilters(){
  ['q','brand','minPrice','maxPrice','minYear','maxYear','maxMileage','transmission','bodyStatus'].forEach(id=>{ if($(id)) $(id).value=''; });
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
      <div class="safeBox upgradedSafeBox">
        <strong>راهنمای معامله امن iGallery</strong>
        <p>قبل از پرداخت، خودرو، مدارک، خلافی و اصالت مالکیت را بررسی کنید. برای قیمت‌گذاری، معاوضه و هماهنگی بازدید با نمایشگاه تماس بگیرید.</p>
      </div>
      <div class="detailTrustMini"><span>قیمت‌گذاری</span><span>معاوضه</span><span>بازدید حضوری</span></div>
      <div class="detailActions">
        <a class="btn" href="tel:${car.seller_phone}">تماس با نمایشگاه iGallery</a>
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
  if(logged){ await adminLoadStats(); await adminLoadPendingCars(); await adminLoadPriceRequests(); await adminLoadPriceSamples(); await adminLoadCars(); await adminLoadLeads(); await adminLoadUsers(); }
}
async function adminLoadStats(){
  const res = await fetch('/api/admin/stats', { headers: adminHeaders() });
  if(!res.ok) return adminLogout();
  const s = await res.json();
  $('statCars').textContent = fmt(s.approvedCars ?? s.cars);
  if($('statPending')) $('statPending').textContent = fmt(s.pendingCars || 0);
  $('statLeads').textContent = fmt(s.leads);
  $('statUsers').textContent = fmt(s.users);
  if($('statValuations')) $('statValuations').textContent = fmt(s.priceRequests || 0);
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

function estimateCard(e, admin=false){
  const conf = Number(e.confidence || 0);
  const confClass = conf >= 75 ? 'good' : conf >= 50 ? 'medium' : 'low';
  return `<article class="valuationCard">
    <div class="valuationHead">
      <div><strong>${escapeHtml(e.brand)} ${escapeHtml(e.model)}</strong><small>${fmt(e.year)} | ${fmt(e.mileage)} کیلومتر | ${escapeHtml(e.body_status || 'بدنه ثبت نشده')}</small></div>
      <span class="confidencePill ${confClass}">${fmt(conf)}٪ اطمینان</span>
    </div>
    <div class="priceRangeGrid">
      <div><span>کف بازار</span><strong>${money(e.estimated_low || 0)}</strong></div>
      <div class="mainEstimate"><span>قیمت پیشنهادی فروش</span><strong>${money(e.estimated_mid || 0)}</strong></div>
      <div><span>سقف بازار</span><strong>${money(e.estimated_high || 0)}</strong></div>
      <div><span>خرید فوری نمایشگاه</span><strong>${money(e.instant_buy_price || 0)}</strong></div>
    </div>
    <div class="marketEvidence"><span>نمونه بررسی‌شده: ${fmt(e.sample_count || 0)}</span><span>منابع: ${escapeHtml(e.source_summary || 'iGallery')}</span></div>
    <p class="estimateNote">${escapeHtml(e.algorithm_notes || '')}</p>
    ${admin ? `<div class="safeBox miniSafe"><strong>کاربر</strong><p>${escapeHtml((e.first_name || '') + ' ' + (e.last_name || ''))} - ${escapeHtml(e.phone || '')}</p></div>
      <div class="adminNoteBox"><textarea id="adminNote_${e.id}" placeholder="یادداشت مدیر یا قیمت نهایی کارشناسی">${escapeHtml(e.admin_notes || '')}</textarea>
      <button class="btn small" onclick="adminUpdatePriceRequest(${e.id})">ثبت یادداشت / بررسی شد</button></div>` : ''}
  </article>`;
}
async function adminLoadPriceRequests(){
  if(!$('adminPriceRequests')) return;
  const res = await fetch('/api/admin/price-requests', { headers: adminHeaders() });
  if(!res.ok) return;
  const rows = await res.json();
  $('adminPriceRequests').innerHTML = rows.map(r => estimateCard(r, true)).join('') || '<p class="msg">درخواست قیمت‌گذاری وجود ندارد.</p>';
  adminLoadStats();
}
async function adminUpdatePriceRequest(id){
  const note = $(`adminNote_${id}`)?.value || '';
  const res = await fetch('/api/admin/price-requests/' + id, { method:'PATCH', headers:{ ...adminHeaders(), 'Content-Type':'application/json' }, body: JSON.stringify({ status:'reviewed', admin_notes: note }) });
  const data = await res.json();
  alert(data.message || data.error || 'به‌روزرسانی انجام شد.');
  adminLoadPriceRequests();
}
async function adminLoadPriceSamples(){
  if(!$('adminPriceSamples')) return;
  const res = await fetch('/api/admin/price-samples', { headers: adminHeaders() });
  if(!res.ok) return;
  const rows = await res.json();
  $('adminPriceSamples').innerHTML = rows.slice(0,8).map(s => rowItem(`${s.source_name}: ${s.brand} ${s.model} ${fmt(s.year)}`, money(s.price), s.created_at)).join('') || '<p class="msg">هنوز نمونه بازار ثبت نشده است.</p>';
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


if($('priceSampleForm')){
  $('priceSampleForm').addEventListener('submit', async e => {
    e.preventDefault(); setMsg('priceSampleMsg','');
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch('/api/admin/price-samples', { method:'POST', headers:{ ...adminHeaders(), 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if(!res.ok) return setMsg('priceSampleMsg', data.error || 'خطا در ذخیره نمونه بازار.');
    e.target.reset(); setMsg('priceSampleMsg', data.message || 'نمونه بازار ذخیره شد.'); adminLoadPriceSamples();
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
  await userLoadValuations();
}
async function userLoadMyAds(){
  if(!$('userMyAds')) return;
  const res = await fetch('/api/user/cars', { headers:{ Authorization:'Bearer ' + userToken() } });
  if(!res.ok) return;
  const cars = await res.json();
  $('userMyAds').innerHTML = cars.map(c => carCard(c)).join('') || '<p class="msg">هنوز آگهی‌ای ثبت نکرده‌اید.</p>';
}

async function userLoadValuations(){
  if(!$('userValuations')) return;
  const res = await fetch('/api/user/price-estimates', { headers:{ Authorization:'Bearer ' + userToken() } });
  if(!res.ok) return;
  const rows = await res.json();
  $('userValuations').innerHTML = rows.map(r => estimateCard(r)).join('') || '<p class="msg">هنوز قیمت‌گذاری ثبت نکرده‌اید.</p>';
}
if($('valuationForm')){
  $('valuationForm').addEventListener('submit', async e => {
    e.preventDefault(); setMsg('valuationMsg','');
    $('valuationResult')?.classList.add('hidden');
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch('/api/user/price-estimate', { method:'POST', headers:{ Authorization:'Bearer ' + userToken(), 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if(!res.ok) return setMsg('valuationMsg', data.error || 'قیمت‌گذاری انجام نشد.');
    setMsg('valuationMsg', data.message || 'قیمت‌گذاری انجام شد.');
    if($('valuationResult')){
      $('valuationResult').innerHTML = estimateCard(data.estimate);
      $('valuationResult').classList.remove('hidden');
    }
    await userLoadValuations();
  });
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
  await userLoadValuations();
  });
}

loadCars();
adminInit();
userInit();

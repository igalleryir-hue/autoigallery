require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '09123060749';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-admin-password';

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'igallery.sqlite'));
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || '').toLowerCase()}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function makeToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '14d' }); }
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'لطفاً وارد پنل مدیریت شوید.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'این بخش فقط برای مدیر سایت فعال است.' });
    next();
  } catch { res.status(401).json({ error: 'نشست مدیریت معتبر نیست.' }); }
}
function requireUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'لطفاً وارد حساب کاربری شوید.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.role !== 'user') return res.status(403).json({ error: 'دسترسی کاربری معتبر نیست.' });
    next();
  } catch { res.status(401).json({ error: 'نشست کاربری معتبر نیست.' }); }
}
function clean(v) { return String(v || '').trim(); }
function normalizePhone(phone) {
  const p = clean(phone).replace(/[\s\-]/g, '');
  return p.startsWith('+98') ? '0' + p.slice(3) : p.startsWith('98') ? '0' + p.slice(2) : p;
}
function isValidIranMobile(phone) { return /^09\d{9}$/.test(normalizePhone(phone)); }
function tokenForUser(user) {
  return makeToken({ id: user.id, first_name: user.first_name, last_name: user.last_name, phone: user.phone, role: 'user' });
}


function num(v, fallback = 0) {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}
function normText(v) { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function conditionFactor(status = '') {
  const s = clean(status);
  if (!s) return 1;
  if (s.includes('بدون') || s.includes('سالم') || s.includes('بی رنگ')) return 1.02;
  if (s.includes('یک') || s.includes('جزئی') || s.includes('لکه')) return 0.97;
  if (s.includes('چند') || s.includes('دور')) return 0.91;
  if (s.includes('تعویض')) return 0.87;
  if (s.includes('تصادف') || s.includes('ضربه')) return 0.82;
  if (s.includes('فنی') || s.includes('تعمیر')) return 0.86;
  return 1;
}
function transmissionFactor(t = '') {
  const s = clean(t);
  if (s.includes('اتومات')) return 1.025;
  if (s.includes('دنده')) return 0.99;
  return 1;
}
function fuelFactor(f = '') {
  const s = clean(f);
  if (s.includes('هیبرید') || s.includes('برقی')) return 1.03;
  if (s.includes('دوگانه')) return 0.985;
  return 1;
}
function percentile(values, p) {
  if (!values.length) return 0;
  const arr = [...values].sort((a,b)=>a-b);
  const idx = (arr.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return arr[lo];
  return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
}
function roundPrice(value) {
  if (!value) return 0;
  const step = value >= 1000000000 ? 10000000 : 5000000;
  return Math.round(value / step) * step;
}
const fallbackBasePrices = [
  { key: 'پژو 207', price: 930000000, year: 1402 }, { key: '207', price: 930000000, year: 1402 },
  { key: 'پژو 206', price: 690000000, year: 1401 }, { key: '206', price: 690000000, year: 1401 },
  { key: 'دنا', price: 1080000000, year: 1402 }, { key: 'تارا', price: 1140000000, year: 1402 },
  { key: 'رانا', price: 760000000, year: 1401 }, { key: 'سمند', price: 720000000, year: 1400 },
  { key: 'کوییک', price: 540000000, year: 1402 }, { key: 'شاهین', price: 880000000, year: 1402 },
  { key: 'چانگان', price: 2350000000, year: 2023 }, { key: 'فونیکس', price: 2600000000, year: 2023 },
  { key: 'هیوندای', price: 2800000000, year: 2020 }, { key: 'کیا', price: 2650000000, year: 2020 },
  { key: 'تویوتا', price: 3600000000, year: 2020 }, { key: 'بنز', price: 6500000000, year: 2018 },
  { key: 'BMW', price: 6200000000, year: 2018 }
];
function fallbackEstimate(input) {
  const search = `${input.brand} ${input.model}`;
  const hit = fallbackBasePrices.find(x => normText(search).includes(normText(x.key))) || fallbackBasePrices.find(x => normText(input.brand).includes(normText(x.key)));
  if (!hit) return null;
  let price = hit.price;
  const y = num(input.year);
  if (y) price *= Math.pow(1.065, y - hit.year);
  price *= (1 - Math.min(0.28, Math.max(0, num(input.mileage) - 20000) / 10000 * 0.0045));
  price *= conditionFactor(input.body_status) * transmissionFactor(input.transmission) * fuelFactor(input.fuel);
  const mid = roundPrice(price);
  return {
    estimated_low: roundPrice(mid * 0.94), estimated_mid: mid, estimated_high: roundPrice(mid * 1.06),
    instant_buy_price: roundPrice(mid * 0.90), confidence: 38, sample_count: 0,
    source_summary: 'قیمت پایه داخلی iGallery (نیازمند اتصال API یا ورود نمونه بازار برای دقت بالاتر)',
    algorithm_notes: 'به دلیل نبود نمونه کافی، سیستم از جدول پایه داخلی و ضرایب سال، کارکرد، بدنه، گیربکس و سوخت استفاده کرد.'
  };
}
function collectPriceSamples(input) {
  const brand = `%${clean(input.brand)}%`;
  const model = `%${clean(input.model)}%`;
  let samples = [];
  const carRows = db.prepare(`SELECT 'iGallery' AS source_name, '' AS source_url, brand, model, year, mileage, price, city, body_status, transmission, created_at
    FROM cars WHERE status = 'approved' AND price > 0 AND brand LIKE @brand AND model LIKE @model`).all({brand, model});
  const extRows = db.prepare(`SELECT source_name, source_url, brand, model, year, mileage, price, city, body_status, transmission, created_at
    FROM external_price_samples WHERE price > 0 AND brand LIKE @brand AND model LIKE @model`).all({brand, model});
  samples = samples.concat(carRows, extRows);
  if (samples.length < 3) {
    const moreCars = db.prepare(`SELECT 'iGallery' AS source_name, '' AS source_url, brand, model, year, mileage, price, city, body_status, transmission, created_at
      FROM cars WHERE status = 'approved' AND price > 0 AND brand LIKE @brand`).all({brand});
    const moreExt = db.prepare(`SELECT source_name, source_url, brand, model, year, mileage, price, city, body_status, transmission, created_at
      FROM external_price_samples WHERE price > 0 AND brand LIKE @brand`).all({brand});
    samples = samples.concat(moreCars, moreExt);
  }
  const unique = new Map();
  for (const s of samples) {
    const key = `${s.source_name}|${s.brand}|${s.model}|${s.year}|${s.mileage}|${s.price}`;
    if (!unique.has(key)) unique.set(key, s);
  }
  return [...unique.values()].filter(s => num(s.price) > 0);
}
function buildAutomaticEstimate(input) {
  const samples = collectPriceSamples(input);
  const targetYear = num(input.year);
  const targetMileage = num(input.mileage);
  const targetCondition = conditionFactor(input.body_status) * transmissionFactor(input.transmission) * fuelFactor(input.fuel);
  const adjusted = samples.map(s => {
    let price = num(s.price);
    const sampleYear = num(s.year, targetYear);
    const sampleMileage = num(s.mileage, targetMileage);
    price *= Math.pow(1.06, targetYear - sampleYear);
    price *= (1 + ((sampleMileage - targetMileage) / 10000) * 0.0045);
    price *= targetCondition / (conditionFactor(s.body_status) * transmissionFactor(s.transmission));
    const modelExact = normText(s.model) === normText(input.model) ? 1 : 0;
    const yearDiff = Math.abs(targetYear - sampleYear);
    const mileageDiff = Math.abs(targetMileage - sampleMileage);
    const weight = Math.max(0.25, 1.2 + modelExact - yearDiff * 0.08 - mileageDiff / 200000);
    return { ...s, adjusted_price: roundPrice(price), weight };
  }).filter(x => x.adjusted_price > 0);
  if (!adjusted.length) return fallbackEstimate(input) || {
    estimated_low: 0, estimated_mid: 0, estimated_high: 0, instant_buy_price: 0, confidence: 12, sample_count: 0,
    source_summary: 'نمونه کافی برای محاسبه خودکار پیدا نشد.',
    algorithm_notes: 'برای این خودرو هنوز نمونه بازار ثبت نشده است. از پنل مدیریت نمونه قیمت وارد کنید یا API قیمت‌گذاری را متصل کنید.'
  };
  const med = percentile(adjusted.map(x => x.adjusted_price), 0.5);
  const filtered = adjusted.filter(x => x.adjusted_price >= med * 0.65 && x.adjusted_price <= med * 1.35);
  const finalSamples = filtered.length >= 2 ? filtered : adjusted;
  const expanded = [];
  finalSamples.forEach(s => { for (let i=0;i<Math.round(s.weight*4);i++) expanded.push(s.adjusted_price); });
  const low = roundPrice(percentile(expanded, 0.22));
  const mid = roundPrice(percentile(expanded, 0.5));
  const high = roundPrice(percentile(expanded, 0.78));
  const exactMatches = finalSamples.filter(s => normText(s.model) === normText(input.model)).length;
  const avgYearDiff = finalSamples.reduce((a,s)=>a+Math.abs(targetYear-num(s.year,targetYear)),0) / finalSamples.length;
  const confidence = Math.max(35, Math.min(92, Math.round(40 + finalSamples.length * 7 + exactMatches * 5 - avgYearDiff * 2)));
  const sources = [...new Set(finalSamples.map(s => s.source_name || 'نمونه بازار'))].slice(0, 6).join('، ');
  return {
    estimated_low: low,
    estimated_mid: mid,
    estimated_high: high,
    instant_buy_price: roundPrice(mid * (confidence >= 75 ? 0.93 : 0.90)),
    confidence,
    sample_count: finalSamples.length,
    source_summary: sources || 'نمونه‌های داخلی iGallery',
    algorithm_notes: `محاسبه خودکار بر اساس ${finalSamples.length} نمونه قابل مقایسه، تعدیل سال ساخت، کارکرد، وضعیت بدنه، گیربکس و حذف قیمت‌های پرت انجام شد.`
  };
}
function savePriceRequest(user, input, estimate) {
  const result = db.prepare(`INSERT INTO price_requests
    (user_id, first_name, last_name, phone, brand, model, year, mileage, color, transmission, fuel, body_status, options, city,
     estimated_low, estimated_mid, estimated_high, instant_buy_price, confidence, sample_count, source_summary, algorithm_notes)
    VALUES (@user_id, @first_name, @last_name, @phone, @brand, @model, @year, @mileage, @color, @transmission, @fuel, @body_status, @options, @city,
     @estimated_low, @estimated_mid, @estimated_high, @instant_buy_price, @confidence, @sample_count, @source_summary, @algorithm_notes)`).run({
      user_id: user?.id || null, first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '',
      brand: clean(input.brand), model: clean(input.model), year: num(input.year), mileage: num(input.mileage), color: clean(input.color),
      transmission: clean(input.transmission), fuel: clean(input.fuel), body_status: clean(input.body_status), options: clean(input.options), city: clean(input.city || 'گنبدکاووس'),
      ...estimate
    });
  return db.prepare('SELECT * FROM price_requests WHERE id = ?').get(result.lastInsertRowid);
}
function validatePricingInput(body) {
  const input = {
    brand: clean(body.brand), model: clean(body.model), year: num(body.year), mileage: num(body.mileage), color: clean(body.color),
    transmission: clean(body.transmission), fuel: clean(body.fuel), body_status: clean(body.body_status), options: clean(body.options), city: clean(body.city || 'گنبدکاووس')
  };
  if (!input.brand || !input.model || !input.year) return { error: 'برند، مدل و سال ساخت الزامی است.' };
  if (input.year < 1350 || (input.year > 1500 && input.year < 1980) || input.year > 2035) return { error: 'سال ساخت معتبر نیست.' };
  if (input.mileage < 0) return { error: 'کارکرد معتبر نیست.' };
  return { input };
}


app.post('/api/admin/login', (req, res) => {
  const { phone, password } = req.body;
  if (clean(phone) !== ADMIN_PHONE || String(password || '') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'موبایل یا رمز عبور مدیر اشتباه است.' });
  }
  res.json({ token: makeToken({ id: 1, name: 'مدیر iGallery', phone: ADMIN_PHONE, role: 'admin' }) });
});

app.post('/api/login', (req, res) => {
  // سازگاری با نسخه‌های قبلی
  const { phone, password } = req.body;
  if (clean(phone) !== ADMIN_PHONE || String(password || '') !== ADMIN_PASSWORD) return res.status(401).json({ error: 'موبایل یا رمز عبور مدیر اشتباه است.' });
  res.json({ token: makeToken({ id: 1, name: 'مدیر iGallery', phone: ADMIN_PHONE, role: 'admin' }) });
});


app.post('/api/user/register', (req, res) => {
  const first = clean(req.body.first_name);
  const last = clean(req.body.last_name);
  const phone = normalizePhone(req.body.phone);
  if (!first || !last || !phone) return res.status(400).json({ error: 'نام، نام خانوادگی و شماره موبایل الزامی است.' });
  if (!isValidIranMobile(phone)) return res.status(400).json({ error: 'شماره موبایل معتبر نیست. نمونه درست: 09123456789' });
  let user = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
  if (user) {
    db.prepare('UPDATE customer_users SET first_name = ?, last_name = ? WHERE phone = ?').run(first, last, phone);
    user = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
  } else {
    const r = db.prepare('INSERT INTO customer_users (first_name, last_name, phone) VALUES (?, ?, ?)').run(first, last, phone);
    user = db.prepare('SELECT * FROM customer_users WHERE id = ?').get(r.lastInsertRowid);
  }
  db.prepare('INSERT INTO leads (first_name, last_name, phone) VALUES (?, ?, ?)').run(user.first_name, user.last_name, user.phone);
  res.json({ token: tokenForUser(user), user, message: 'ثبت‌نام انجام شد و وارد پنل شدید.' });
});

app.post('/api/user/login', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!isValidIranMobile(phone)) return res.status(400).json({ error: 'شماره موبایل معتبر نیست.' });
  const user = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
  if (!user) return res.status(404).json({ error: 'این شماره هنوز ثبت‌نام نشده است. اول ثبت‌نام کنید.' });
  res.json({ token: tokenForUser(user), user, message: 'ورود انجام شد.' });
});

app.post('/api/user/price-estimate', requireUser, (req, res) => {
  const checked = validatePricingInput(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const user = db.prepare('SELECT * FROM customer_users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'کاربر پیدا نشد.' });
  const estimate = buildAutomaticEstimate(checked.input);
  const saved = savePriceRequest(user, checked.input, estimate);
  res.json({ message: 'قیمت‌گذاری خودکار انجام شد.', estimate: saved });
});

app.get('/api/user/price-estimates', requireUser, (req, res) => {
  const rows = db.prepare('SELECT * FROM price_requests WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

app.post('/api/price-estimate/preview', (req, res) => {
  const checked = validatePricingInput(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const estimate = buildAutomaticEstimate(checked.input);
  res.json({ estimate });
});

app.get('/api/user/me', requireUser, (req, res) => {
  const user = db.prepare('SELECT id, first_name, last_name, phone, created_at FROM customer_users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'کاربر پیدا نشد.' });
  res.json(user);
});

app.post('/api/register', (req, res) => {
  const first = clean(req.body.first_name);
  const last = clean(req.body.last_name);
  const phone = clean(req.body.phone);
  if (!first || !last || !phone) return res.status(400).json({ error: 'نام، نام خانوادگی و شماره موبایل الزامی است.' });
  db.prepare('INSERT INTO leads (first_name, last_name, phone) VALUES (?, ?, ?)').run(first, last, phone);
  res.json({ message: 'اطلاعات شما ثبت شد. مشاوران iGallery با شما تماس می‌گیرند.' });
});

app.get('/api/user/cars', requireUser, (req, res) => {
  const rows = db.prepare('SELECT * FROM cars WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

app.post('/api/user/cars', requireUser, upload.single('image'), (req, res) => {
  const b = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : '';
  const required = ['title', 'brand', 'model', 'year', 'mileage', 'price'];
  for (const key of required) if (!b[key]) return res.status(400).json({ error: `فیلد ${key} الزامی است.` });
  const user = db.prepare('SELECT * FROM customer_users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'کاربر پیدا نشد.' });
  const result = db.prepare(`INSERT INTO cars
    (title, brand, model, year, mileage, price, city, color, transmission, fuel, body_status, description, seller_name, seller_phone, image, user_id, status)
    VALUES (@title, @brand, @model, @year, @mileage, @price, @city, @color, @transmission, @fuel, @body_status, @description, @seller_name, @seller_phone, @image, @user_id, 'pending')`).run({
      title: clean(b.title), brand: clean(b.brand), model: clean(b.model), year: Number(b.year), mileage: Number(b.mileage), price: Number(b.price),
      city: 'گنبدکاووس', color: clean(b.color), transmission: clean(b.transmission), fuel: clean(b.fuel), body_status: clean(b.body_status),
      description: clean(b.description), seller_name: `${user.first_name} ${user.last_name}`.trim(), seller_phone: user.phone, image, user_id: user.id
    });
  res.json({ id: result.lastInsertRowid, message: 'آگهی شما ثبت شد و پس از تایید مدیر در سایت نمایش داده می‌شود.' });
});

app.get('/api/cars', (req, res) => {
  const { q = '', brand = '', minPrice = 0, maxPrice = 999999999999, sort = 'new' } = req.query;
  const order = sort === 'cheap' ? 'price ASC' : sort === 'expensive' ? 'price DESC' : 'created_at DESC';
  const rows = db.prepare(`SELECT * FROM cars WHERE status = 'approved'
    AND (title LIKE @term OR brand LIKE @term OR model LIKE @term)
    AND brand LIKE @brand
    AND price BETWEEN @minPrice AND @maxPrice
    ORDER BY ${order}`).all({ term: `%${q}%`, brand: `%${brand}%`, minPrice, maxPrice });
  res.json(rows);
});

app.get('/api/cars/:id', (req, res) => {
  const car = db.prepare("SELECT * FROM cars WHERE id = ? AND status = 'approved'").get(req.params.id);
  if (!car) return res.status(404).json({ error: 'خودرو پیدا نشد یا هنوز تایید نشده است.' });
  res.json(car);
});

app.get('/api/admin/stats', requireAdmin, (_, res) => {
  res.json({
    cars: db.prepare('SELECT COUNT(*) AS c FROM cars').get().c,
    approvedCars: db.prepare("SELECT COUNT(*) AS c FROM cars WHERE status = 'approved'").get().c,
    pendingCars: db.prepare("SELECT COUNT(*) AS c FROM cars WHERE status = 'pending'").get().c,
    rejectedCars: db.prepare("SELECT COUNT(*) AS c FROM cars WHERE status = 'rejected'").get().c,
    leads: db.prepare('SELECT COUNT(*) AS c FROM leads').get().c,
    users: db.prepare('SELECT COUNT(*) AS c FROM customer_users').get().c,
    priceRequests: db.prepare('SELECT COUNT(*) AS c FROM price_requests').get().c
  });
});
app.get('/api/admin/cars', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM cars ORDER BY created_at DESC').all()));
app.get('/api/admin/leads', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all()));
app.get('/api/admin/users', requireAdmin, (_, res) => res.json(db.prepare('SELECT id, first_name, last_name, phone, created_at FROM customer_users ORDER BY created_at DESC').all()));
app.get('/api/admin/price-requests', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM price_requests ORDER BY created_at DESC').all()));
app.patch('/api/admin/price-requests/:id', requireAdmin, (req, res) => {
  const status = clean(req.body.status || 'reviewed');
  const admin_notes = clean(req.body.admin_notes);
  const result = db.prepare("UPDATE price_requests SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, admin_notes, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'درخواست قیمت‌گذاری پیدا نشد.' });
  res.json({ message: 'درخواست قیمت‌گذاری به‌روزرسانی شد.' });
});
app.post('/api/admin/price-samples', requireAdmin, (req, res) => {
  const b = req.body;
  const required = ['source_name', 'brand', 'model', 'year', 'price'];
  for (const key of required) if (!clean(b[key])) return res.status(400).json({ error: `فیلد ${key} الزامی است.` });
  const r = db.prepare(`INSERT INTO external_price_samples (source_name, source_url, brand, model, year, mileage, price, city, body_status, transmission)
    VALUES (@source_name, @source_url, @brand, @model, @year, @mileage, @price, @city, @body_status, @transmission)`).run({
      source_name: clean(b.source_name), source_url: clean(b.source_url), brand: clean(b.brand), model: clean(b.model), year: num(b.year), mileage: num(b.mileage), price: num(b.price), city: clean(b.city), body_status: clean(b.body_status), transmission: clean(b.transmission)
    });
  res.json({ id: r.lastInsertRowid, message: 'نمونه قیمت بازار ذخیره شد و در قیمت‌گذاری‌های بعدی استفاده می‌شود.' });
});
app.get('/api/admin/price-samples', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM external_price_samples ORDER BY created_at DESC LIMIT 200').all()));
app.get('/api/admin/pending-cars', requireAdmin, (_, res) => res.json(db.prepare("SELECT * FROM cars WHERE status = 'pending' ORDER BY created_at DESC").all()));
app.patch('/api/admin/cars/:id/status', requireAdmin, (req, res) => {
  const status = clean(req.body.status);
  if (!['approved', 'pending', 'rejected'].includes(status)) return res.status(400).json({ error: 'وضعیت آگهی معتبر نیست.' });
  const result = db.prepare('UPDATE cars SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'خودرو پیدا نشد.' });
  const message = status === 'approved' ? 'آگهی تایید و در سایت منتشر شد.' : status === 'rejected' ? 'آگهی رد شد.' : 'آگهی در انتظار تایید قرار گرفت.';
  res.json({ message });
});

app.post('/api/admin/cars', requireAdmin, upload.single('image'), (req, res) => {
  const b = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : '';
  const required = ['title', 'brand', 'model', 'year', 'mileage', 'price', 'seller_name', 'seller_phone'];
  for (const key of required) if (!b[key]) return res.status(400).json({ error: `فیلد ${key} الزامی است.` });
  const result = db.prepare(`INSERT INTO cars
    (title, brand, model, year, mileage, price, city, color, transmission, fuel, body_status, description, seller_name, seller_phone, image, user_id, status)
    VALUES (@title, @brand, @model, @year, @mileage, @price, @city, @color, @transmission, @fuel, @body_status, @description, @seller_name, @seller_phone, @image, @user_id, 'approved')`).run({
      title: clean(b.title), brand: clean(b.brand), model: clean(b.model), year: Number(b.year), mileage: Number(b.mileage), price: Number(b.price),
      city: 'گنبدکاووس', color: clean(b.color), transmission: clean(b.transmission), fuel: clean(b.fuel), body_status: clean(b.body_status),
      description: clean(b.description), seller_name: clean(b.seller_name), seller_phone: clean(b.seller_phone), image, user_id: 1
    });
  res.json({ id: result.lastInsertRowid, message: 'خودرو با موفقیت در سایت ثبت شد.' });
});

app.delete('/api/admin/cars/:id', requireAdmin, (req, res) => {
  const car = db.prepare('SELECT image FROM cars WHERE id = ?').get(req.params.id);
  const result = db.prepare('DELETE FROM cars WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'خودرو پیدا نشد.' });
  if (car?.image) {
    const filePath = path.join(__dirname, 'public', car.image);
    fs.existsSync(filePath) && fs.unlink(filePath, () => {});
  }
  res.json({ message: 'خودرو حذف شد.' });
});

// سازگاری با نسخه قبلی پنل: ثبت خودرو فقط با توکن مدیر
app.post('/api/cars', requireAdmin, upload.single('image'), (req, res) => {
  const b = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : '';
  const required = ['title', 'brand', 'model', 'year', 'mileage', 'price', 'seller_name', 'seller_phone'];
  for (const key of required) if (!b[key]) return res.status(400).json({ error: `فیلد ${key} الزامی است.` });
  const result = db.prepare(`INSERT INTO cars
    (title, brand, model, year, mileage, price, city, color, transmission, fuel, body_status, description, seller_name, seller_phone, image, user_id, status)
    VALUES (@title, @brand, @model, @year, @mileage, @price, @city, @color, @transmission, @fuel, @body_status, @description, @seller_name, @seller_phone, @image, @user_id, 'approved')`).run({
      title: clean(b.title), brand: clean(b.brand), model: clean(b.model), year: Number(b.year), mileage: Number(b.mileage), price: Number(b.price),
      city: 'گنبدکاووس', color: clean(b.color), transmission: clean(b.transmission), fuel: clean(b.fuel), body_status: clean(b.body_status),
      description: clean(b.description), seller_name: clean(b.seller_name), seller_phone: clean(b.seller_phone), image, user_id: 1
    });
  res.json({ id: result.lastInsertRowid, message: 'خودرو با موفقیت ثبت شد.' });
});
app.get('/api/my-cars', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM cars ORDER BY created_at DESC').all()));
app.get('/api/leads', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all()));
app.delete('/api/cars/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM cars WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'خودرو پیدا نشد.' });
  res.json({ message: 'خودرو حذف شد.' });
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`iGallery running on port ${PORT}`);
});

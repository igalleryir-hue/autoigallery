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
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'console';
const SMS_API_KEY = process.env.SMS_API_KEY || '';
const SMS_TEMPLATE = process.env.SMS_TEMPLATE || 'verify';
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

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
function makeOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function futureIso(minutes) { return new Date(Date.now() + minutes * 60 * 1000).toISOString(); }
function isExpired(iso) { return new Date(iso).getTime() < Date.now(); }
function sendSmsWithKavenegar(phone, code) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const params = new URLSearchParams({ receptor: phone, token: code, template: SMS_TEMPLATE });
    const url = `https://api.kavenegar.com/v1/${SMS_API_KEY}/verify/lookup.json?${params.toString()}`;
    https.get(url, (resp) => {
      let body = '';
      resp.on('data', chunk => body += chunk);
      resp.on('end', () => resp.statusCode >= 200 && resp.statusCode < 300 ? resolve(body) : reject(new Error(body || 'خطا در ارسال پیامک')));
    }).on('error', reject);
  });
}
async function sendOtpSms(phone, code) {
  if (SMS_PROVIDER === 'kavenegar' && SMS_API_KEY) {
    await sendSmsWithKavenegar(phone, code);
    return { sent: true, provider: 'kavenegar' };
  }
  console.log(`OTP for ${phone}: ${code}`);
  return { sent: false, provider: 'console' };
}
function createOtp(phone, purpose, firstName = '', lastName = '') {
  const code = makeOtp();
  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE phone = ? AND consumed = 0').run(phone);
  db.prepare(`INSERT INTO otp_codes (phone, code, purpose, first_name, last_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(phone, code, purpose, firstName, lastName, futureIso(OTP_TTL_MINUTES));
  return code;
}
function tokenForUser(user) {
  return makeToken({ id: user.id, first_name: user.first_name, last_name: user.last_name, phone: user.phone, role: 'user' });
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

app.post('/api/user/request-otp', async (req, res) => {
  const purpose = clean(req.body.purpose || 'login');
  const phone = normalizePhone(req.body.phone);
  const first = clean(req.body.first_name);
  const last = clean(req.body.last_name);
  if (!isValidIranMobile(phone)) return res.status(400).json({ error: 'شماره موبایل معتبر نیست. نمونه درست: 09123456789' });
  if (!['register', 'login'].includes(purpose)) return res.status(400).json({ error: 'نوع درخواست معتبر نیست.' });
  if (purpose === 'register' && (!first || !last)) return res.status(400).json({ error: 'نام و نام خانوادگی برای ثبت‌نام الزامی است.' });
  const existing = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
  if (purpose === 'login' && !existing) return res.status(404).json({ error: 'این شماره هنوز ثبت‌نام نشده است. اول ثبت‌نام کنید.' });
  const recent = db.prepare("SELECT created_at FROM otp_codes WHERE phone = ? AND consumed = 0 ORDER BY id DESC LIMIT 1").get(phone);
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60 * 1000) return res.status(429).json({ error: 'کد قبلی تازه ارسال شده است. لطفاً یک دقیقه دیگر تلاش کنید.' });
  const code = createOtp(phone, purpose, first, last);
  try {
    const sms = await sendOtpSms(phone, code);
    res.json({ message: sms.sent ? 'کد تایید برای شماره شما ارسال شد.' : 'کد تایید در لاگ سرور چاپ شد. برای ارسال واقعی پیامک، پنل پیامکی را تنظیم کنید.' });
  } catch (err) {
    console.error('SMS send error:', err.message);
    res.status(500).json({ error: 'ارسال پیامک انجام نشد. تنظیمات پنل پیامکی را بررسی کنید.' });
  }
});

app.post('/api/user/verify-otp', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const code = clean(req.body.code);
  if (!isValidIranMobile(phone) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'شماره موبایل یا کد تایید معتبر نیست.' });
  const otp = db.prepare("SELECT * FROM otp_codes WHERE phone = ? AND consumed = 0 ORDER BY id DESC LIMIT 1").get(phone);
  if (!otp) return res.status(400).json({ error: 'کد فعالی برای این شماره وجود ندارد. دوباره کد بگیرید.' });
  if (isExpired(otp.expires_at)) {
    db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(otp.id);
    return res.status(400).json({ error: 'کد تایید منقضی شده است. دوباره کد بگیرید.' });
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(otp.id);
    return res.status(429).json({ error: 'تعداد تلاش بیش از حد مجاز بود. دوباره کد بگیرید.' });
  }
  if (otp.code !== code) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(otp.id);
    return res.status(401).json({ error: 'کد تایید اشتباه است.' });
  }
  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(otp.id);
  let user = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
  if (otp.purpose === 'register') {
    if (user) {
      db.prepare('UPDATE customer_users SET first_name = ?, last_name = ? WHERE phone = ?').run(otp.first_name, otp.last_name, phone);
      user = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
    } else {
      const r = db.prepare('INSERT INTO customer_users (first_name, last_name, phone) VALUES (?, ?, ?)').run(otp.first_name, otp.last_name, phone);
      user = db.prepare('SELECT * FROM customer_users WHERE id = ?').get(r.lastInsertRowid);
    }
    db.prepare('INSERT INTO leads (first_name, last_name, phone) VALUES (?, ?, ?)').run(user.first_name, user.last_name, user.phone);
  } else if (!user) {
    return res.status(404).json({ error: 'این شماره هنوز ثبت‌نام نشده است.' });
  }
  res.json({ token: tokenForUser(user), user, message: 'ورود با موفقیت انجام شد.' });
});

// نسخه‌های قدیمی این مسیرها دیگر مستقیم وارد نمی‌کنند؛ ابتدا باید کد تایید گرفته شود.
app.post('/api/user/register', (req, res) => res.status(410).json({ error: 'برای ثبت‌نام امن از دریافت کد تایید استفاده کنید.' }));
app.post('/api/user/login', (req, res) => res.status(410).json({ error: 'برای ورود امن از دریافت کد تایید استفاده کنید.' }));

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
    users: db.prepare('SELECT COUNT(*) AS c FROM customer_users').get().c
  });
});
app.get('/api/admin/cars', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM cars ORDER BY created_at DESC').all()));
app.get('/api/admin/leads', requireAdmin, (_, res) => res.json(db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all()));
app.get('/api/admin/users', requireAdmin, (_, res) => res.json(db.prepare('SELECT id, first_name, last_name, phone, created_at FROM customer_users ORDER BY created_at DESC').all()));
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

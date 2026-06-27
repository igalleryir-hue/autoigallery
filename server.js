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
  const phone = clean(req.body.phone);
  if (!first || !last || !phone) return res.status(400).json({ error: 'نام، نام خانوادگی و شماره موبایل الزامی است.' });
  const existing = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
  let user = existing;
  if (existing) {
    db.prepare('UPDATE customer_users SET first_name = ?, last_name = ? WHERE phone = ?').run(first, last, phone);
    user = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
  } else {
    const r = db.prepare('INSERT INTO customer_users (first_name, last_name, phone) VALUES (?, ?, ?)').run(first, last, phone);
    user = db.prepare('SELECT * FROM customer_users WHERE id = ?').get(r.lastInsertRowid);
  }
  db.prepare('INSERT INTO leads (first_name, last_name, phone) VALUES (?, ?, ?)').run(first, last, phone);
  res.json({ token: makeToken({ id: user.id, first_name: user.first_name, last_name: user.last_name, phone: user.phone, role: 'user' }), user });
});

app.post('/api/user/login', (req, res) => {
  const phone = clean(req.body.phone);
  const user = db.prepare('SELECT * FROM customer_users WHERE phone = ?').get(phone);
  if (!user) return res.status(404).json({ error: 'این شماره هنوز ثبت‌نام نشده است.' });
  res.json({ token: makeToken({ id: user.id, first_name: user.first_name, last_name: user.last_name, phone: user.phone, role: 'user' }), user });
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
app.listen(PORT, () => console.log(`iGallery running on http://localhost:${PORT}`));

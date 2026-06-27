const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'igallery.sqlite'));

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const demo = db.prepare('SELECT COUNT(*) as count FROM cars').get();
if (demo.count === 0) {
  const insert = db.prepare(`INSERT INTO cars
    (title, brand, model, year, mileage, price, city, color, transmission, fuel, body_status, description, seller_name, seller_phone, image, user_id, status)
    VALUES (@title, @brand, @model, @year, @mileage, @price, @city, @color, @transmission, @fuel, @body_status, @description, @seller_name, @seller_phone, @image, @user_id, 'approved')`);
  insert.run({ title: 'پژو ۲۰۷ اتوماتیک پانوراما', brand: 'پژو', model: '۲۰۷', year: 1402, mileage: 18000, price: 980000000, city: 'گنبدکاووس', color: 'سفید', transmission: 'اتوماتیک', fuel: 'بنزین', body_status: 'بدون رنگ', description: 'بسیار تمیز، سرویس‌ها انجام شده، آماده بازدید.', seller_name: 'ادمین iGallery', seller_phone: '09123060749', image: '', user_id: null });
  insert.run({ title: 'دنا پلاس توربو', brand: 'ایران خودرو', model: 'دنا پلاس', year: 1401, mileage: 42000, price: 890000000, city: 'گنبدکاووس', color: 'مشکی', transmission: 'دنده‌ای', fuel: 'بنزین', body_status: 'یک لکه رنگ', description: 'فنی سالم، بیمه کامل، قیمت قابل مذاکره.', seller_name: 'ادمین iGallery', seller_phone: '09123060749', image: '', user_id: null });
}

console.log('Database initialized at data/igallery.sqlite');

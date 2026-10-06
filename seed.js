const db = require('./db.js');
const crypto = require('crypto');

const uid = () => crypto.randomBytes(8).toString('hex');

async function seed() {
  try {
    await db.init();
    const pool = db.pool();

    // Thêm các loại vật liệu phổ biến
    const mats = [
      { id: uid(), name: 'Sắt', price: 10000 },
      { id: uid(), name: 'Đồng', price: 150000 },
      { id: uid(), name: 'Nhôm', price: 45000 },
      { id: uid(), name: 'Nhựa', price: 15000 },
      { id: uid(), name: 'Giấy', price: 4000 }
    ];

    for (const m of mats) {
      await pool.query('INSERT IGNORE INTO materials (id, name, price) VALUES (?, ?, ?)', [m.id, m.name, m.price]);
    }
    
    // Lấy ID của vật liệu (phòng trường hợp đã có)
    const [dbMats] = await pool.query('SELECT id, name FROM materials');
    const getMatId = (name) => dbMats.find(m => m.name === name)?.id;
    
    const satId = getMatId('Sắt');
    const dongId = getMatId('Đồng');
    const nhomId = getMatId('Nhôm');

    // Thêm các đơn hàng test (nhập và bán)
    // type: 'in' = Nhập, 'out' = Bán
    await pool.query(`
      INSERT INTO entries (id, type, material_id, price, qty, note, entry_time) VALUES 
      (?, 'in', ?, 10000, 500, 'Nhập lô sắt', NOW() - INTERVAL 2 DAY),
      (?, 'in', ?, 150000, 20, 'Nhập dây đồng', NOW() - INTERVAL 1 DAY),
      (?, 'out', ?, 12000, 300, 'Bán sắt cho nhà máy', NOW() - INTERVAL 12 HOUR),
      (?, 'in', ?, 45000, 50, 'Nhập lon nhôm', NOW()),
      (?, 'out', ?, 160000, 10, 'Bán đồng lẻ', NOW())
    `, [uid(), satId, uid(), dongId, uid(), satId, uid(), nhomId, uid(), dongId]);
    
    console.log('Test data seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi seed data:', err);
    process.exit(1);
  }
}

seed();

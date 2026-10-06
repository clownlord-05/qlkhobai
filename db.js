// Kết nối MySQL, tạo database + bảng tự động, nhập dữ liệu cũ (data/*.json) nếu có.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// đọc file .env (KEY=VALUE), không cần thư viện ngoài
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch {}

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: +process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quanlyphelieu'
};
if (!/^\w+$/.test(cfg.database)) throw new Error('DB_NAME chỉ gồm chữ, số, _');

let pool;
const q = (sql, params) => pool.query(sql, params).then(r => r[0]);

// 'YYYY-MM-DDTHH:mm' <-> DATETIME
const toDb = s => s.replace('T', ' ') + ':00';
const fromDb = s => String(s).replace(' ', 'T').slice(0, 16);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(32) PRIMARY KEY,
    salt CHAR(32) NOT NULL,
    hash CHAR(128) NOT NULL,
    role ENUM('admin','user') NOT NULL DEFAULT 'user',
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS materials (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    price DECIMAL(15,2) NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS entries (
    id VARCHAR(32) PRIMARY KEY,
    type ENUM('in','out') NOT NULL,
    entry_time DATETIME NOT NULL,
    material_id VARCHAR(32) NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    qty DECIMAL(15,3) NOT NULL,
    note VARCHAR(255) NOT NULL DEFAULT '',
    created_by VARCHAR(32) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_time (entry_time),
    CONSTRAINT fk_entry_mat FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    changed_at DATETIME NOT NULL,
    material_id VARCHAR(32) NOT NULL,
    old_price DECIMAL(15,2) NULL,
    new_price DECIMAL(15,2) NOT NULL,
    changed_by VARCHAR(32) NULL,
    INDEX idx_mat (material_id),
    CONSTRAINT fk_hist_mat FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(64) NULL,
    msg VARCHAR(500) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

async function init() {
  const c = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password });
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.end();
  pool = mysql.createPool({
    ...cfg, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4',
    dateStrings: true, decimalNumbers: true
  });
  for (const s of SCHEMA) await q(s);
  await migrateOld();
}

// nhập dữ liệu từ bản dùng file JSON cũ (chỉ khi bảng còn trống)
async function migrateOld() {
  const dir = path.join(__dirname, 'data');
  const read = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } };
  const nUsers = (await q('SELECT COUNT(*) n FROM users'))[0].n;
  const users = read('users.json');
  if (!nUsers && users) {
    for (const [name, u] of Object.entries(users))
      await q('INSERT INTO users (username,salt,hash,role) VALUES (?,?,?,?)', [name, u.salt, u.hash, u.role === 'admin' ? 'admin' : 'user']);
    console.log('Đã nhập tài khoản từ data/users.json');
  }
  const nMat = (await q('SELECT COUNT(*) n FROM materials'))[0].n;
  const old = read('db.json');
  if (!nMat && old && Array.isArray(old.mats)) {
    for (const m of old.mats) await q('INSERT INTO materials (id,name,price) VALUES (?,?,?)', [m.id, m.name, m.price]);
    for (const e of old.entries || []) await q('INSERT INTO entries (id,type,entry_time,material_id,price,qty,note) VALUES (?,?,?,?,?,?,?)',
      [e.id, e.type === 'out' ? 'out' : 'in', toDb(e.time), e.matId, e.price, e.qty, String(e.note || '').slice(0, 255)]);
    for (const h of old.hist || []) await q('INSERT INTO price_history (changed_at,material_id,old_price,new_price) VALUES (?,?,?,?)',
      [toDb(h.time), h.matId, h.old, h.new]);
    console.log('Đã nhập dữ liệu từ data/db.json');
  }
}

module.exports = { init, q, toDb, fromDb, cfg, pool: () => pool };

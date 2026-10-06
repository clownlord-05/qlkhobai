// Máy chủ + API, dữ liệu lưu MySQL. Chạy: node server.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const U = require('./users');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // mặc định chỉ máy này truy cập được
const TLS = process.env.TLS_KEY && process.env.TLS_CERT;
const IDLE_MS = 30 * 60 * 1000;      // 30 phút không thao tác -> đăng xuất
const ABS_MS = 12 * 60 * 60 * 1000;  // tối đa 12 giờ

const ip = req => req.socket.remoteAddress;
const audit = (msg, req) => db.q('INSERT INTO audit_log (ip,msg) VALUES (?,?)', [req ? ip(req) : null, String(msg).slice(0, 500)]).catch(() => {});

// ---- Phiên đăng nhập (lưu RAM, khởi động lại là hết) ----
const sessions = new Map(); // sha256(token) -> {user, csrf, created, last}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
async function getSession(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const k = sha(m[1]), s = sessions.get(k), now = Date.now();
  if (!s) return null;
  if (now - s.last > IDLE_MS || now - s.created > ABS_MS) { sessions.delete(k); return null; }
  const u = await U.getUser(s.user);
  if (!u) { sessions.delete(k); return null; }
  s.last = now; s.key = k; s.role = u.role;
  return s;
}
setInterval(() => { const n = Date.now(); for (const [k, s] of sessions) if (n - s.last > IDLE_MS || n - s.created > ABS_MS) sessions.delete(k); }, 60000).unref();
const dropSessions = name => { for (const [k, x] of sessions) if (x.user === name) sessions.delete(k); };

// ---- Chống dò mật khẩu ----
const fails = new Map(); // key -> {n, until, first}
const MAX_FAIL = 5, LOCK_MS = 15 * 60 * 1000;
const locked = key => { const f = fails.get(key); return f && f.until > Date.now(); };
function fail(key) {
  const now = Date.now(); let f = fails.get(key);
  if (!f || now - f.first > LOCK_MS) f = { n: 0, first: now, until: 0 };
  f.n++; if (f.n >= MAX_FAIL) f.until = now + LOCK_MS;
  fails.set(key, f);
}

// ---- Tiện ích ----
const SEC = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  ...(TLS ? { 'Strict-Transport-Security': 'max-age=31536000' } : {})
};
function send(res, code, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(code, { ...SEC, 'Content-Type': type, ...extra });
  res.end(body);
}
const json = (res, code, obj, extra) => send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8', extra);
const bad = (res, msg) => json(res, 400, { error: msg });
function body(req, limit = 64 * 1024) {
  return new Promise((ok, no) => {
    let b = [], n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { no(new Error('big')); req.destroy(); } else b.push(c); });
    req.on('end', () => ok(Buffer.concat(b).toString('utf8')));
    req.on('error', no);
  });
}
const readJson = async (req, limit) => { try { return JSON.parse(await body(req, limit)) || {}; } catch { return null; } };
const sameOrigin = req => { const o = req.headers.origin; return !o || o === `${TLS ? 'https' : 'http'}://${req.headers.host}`; };

const FILES = { // chỉ phục vụ các file nằm trong danh sách này: [file, type, cần đăng nhập]
  '/login': ['login.html', 'text/html; charset=utf-8', false],
  '/login.css': ['login.css', 'text/css; charset=utf-8', false],
  '/login.js': ['login.js', 'application/javascript; charset=utf-8', false],
  '/': ['index.html', 'text/html; charset=utf-8', true],
  '/style.css': ['style.css', 'text/css; charset=utf-8', true],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8', true],
  '/export.js': ['export.js', 'application/javascript; charset=utf-8', true],
  '/vendor/exceljs.min.js': ['vendor/exceljs.min.js', 'application/javascript', true]
};

// ---- Kiểm tra dữ liệu nhập ----
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ID_RE = /^[a-zA-Z0-9]{1,32}$/;
const newId = () => crypto.randomBytes(6).toString('hex');
const money = v => typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1e12;
const nowLocal = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

async function getData() {
  const [mats, entries, hist] = await Promise.all([
    db.q('SELECT id,name,price FROM materials ORDER BY name'),
    db.q('SELECT id,type,entry_time,material_id,price,qty,note FROM entries ORDER BY entry_time DESC, created_at DESC'),
    db.q('SELECT changed_at,material_id,old_price,new_price FROM price_history ORDER BY changed_at, id')
  ]);
  return {
    mats,
    entries: entries.map(e => ({ id: e.id, type: e.type, time: db.fromDb(e.entry_time), matId: e.material_id, price: e.price, qty: e.qty, note: e.note })),
    hist: hist.map(h => ({ time: db.fromDb(h.changed_at), matId: h.material_id, old: h.old_price, new: h.new_price }))
  };
}

async function handle(req, res) {
  const url = req.url.split('?')[0];
  const cookieFlags = `HttpOnly; SameSite=Strict; Path=/${TLS ? '; Secure' : ''}`;

  if (req.method === 'POST' && url === '/api/login') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'Forbidden' });
    const d = await readJson(req, 4096); if (!d) return bad(res, 'Bad request');
    const u = String(d.username || '').slice(0, 64), p = String(d.password || '').slice(0, 256);
    const kIp = 'ip:' + ip(req), kU = 'u:' + u.toLowerCase();
    if (locked(kIp) || locked(kU)) { audit(`LOCKED ${u}`, req); return json(res, 429, { error: 'Quá nhiều lần sai. Thử lại sau 15 phút.' }); }
    if (!(await U.verify(u, p))) {
      fail(kIp); fail(kU); audit(`LOGIN_FAIL ${u}`, req);
      await new Promise(r => setTimeout(r, 800));
      return json(res, 401, { error: 'Sai tài khoản hoặc mật khẩu' });
    }
    fails.delete(kIp); fails.delete(kU);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(sha(token), { user: u, csrf: crypto.randomBytes(24).toString('hex'), created: Date.now(), last: Date.now() });
    audit(`LOGIN_OK ${u}`, req);
    return json(res, 200, { ok: true }, { 'Set-Cookie': `sid=${token}; ${cookieFlags}; Max-Age=${ABS_MS / 1000}` });
  }

  const s = await getSession(req);

  if (url.startsWith('/api/')) {
    if (!s) return json(res, 401, { error: 'unauthorized' });
    const isAdmin = s.role === 'admin';
    const M = req.method;
    if (M === 'GET') {
      if (url === '/api/me') return json(res, 200, { user: s.user, csrf: s.csrf, role: s.role });
      if (url === '/api/data') return json(res, 200, await getData());
      if (url === '/api/users') {
        if (!isAdmin) return json(res, 403, { error: 'Forbidden' });
        return json(res, 200, (await U.listUsers()).map(u => ({ username: u.username, role: u.role, created: u.created ? u.created.replace(' ', 'T') : null })));
      }
      return json(res, 404, { error: 'not found' });
    }
    // các thao tác thay đổi dữ liệu: bắt buộc cùng origin + CSRF token
    if (!sameOrigin(req) || req.headers['x-csrf-token'] !== s.csrf) return json(res, 403, { error: 'Forbidden' });

    if (M === 'POST' && url === '/api/logout') {
      sessions.delete(s.key); audit(`LOGOUT ${s.user}`, req);
      return json(res, 200, { ok: true }, { 'Set-Cookie': `sid=; ${cookieFlags}; Max-Age=0` });
    }

    // --- Vật liệu ---
    if (M === 'POST' && url === '/api/materials') {
      const d = await readJson(req); if (!d) return bad(res, 'Dữ liệu không hợp lệ');
      const name = String(d.name || '').trim();
      if (!name || name.length > 100) return bad(res, 'Tên vật liệu 1-100 ký tự');
      if (!money(d.price)) return bad(res, 'Đơn giá không hợp lệ');
      if ((await db.q('SELECT 1 FROM materials WHERE name=?', [name])).length) return bad(res, 'Vật liệu đã tồn tại');
      const id = newId(), conn = await db.pool().getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('INSERT INTO materials (id,name,price) VALUES (?,?,?)', [id, name, d.price]);
        await conn.query('INSERT INTO price_history (changed_at,material_id,old_price,new_price,changed_by) VALUES (?,?,NULL,?,?)', [db.toDb(nowLocal()), id, d.price, s.user]);
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
      audit(`MAT_ADD ${name} by ${s.user}`, req);
      return json(res, 200, { ok: true, id });
    }
    let m = /^\/api\/materials\/([a-zA-Z0-9]{1,32})$/.exec(url);
    if (m && M === 'PUT') {
      const d = await readJson(req); if (!d || !money(d.price)) return bad(res, 'Đơn giá không hợp lệ');
      const conn = await db.pool().getConnection();
      try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT price FROM materials WHERE id=? FOR UPDATE', [m[1]]);
        if (!rows.length) { await conn.rollback(); return json(res, 404, { error: 'Không tìm thấy vật liệu' }); }
        if (+rows[0].price !== d.price) {
          await conn.query('UPDATE materials SET price=? WHERE id=?', [d.price, m[1]]);
          await conn.query('INSERT INTO price_history (changed_at,material_id,old_price,new_price,changed_by) VALUES (?,?,?,?,?)', [db.toDb(nowLocal()), m[1], rows[0].price, d.price, s.user]);
        }
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
      audit(`PRICE ${m[1]} -> ${d.price} by ${s.user}`, req);
      return json(res, 200, { ok: true });
    }
    if (m && M === 'DELETE') {
      if ((await db.q('SELECT 1 FROM entries WHERE material_id=? LIMIT 1', [m[1]])).length) return bad(res, 'Vật liệu đã có phiếu, không thể xóa');
      await db.q('DELETE FROM materials WHERE id=?', [m[1]]);
      audit(`MAT_DEL ${m[1]} by ${s.user}`, req);
      return json(res, 200, { ok: true });
    }

    // --- Phiếu nhập/bán ---
    if (M === 'POST' && url === '/api/entries') {
      const d = await readJson(req); if (!d) return bad(res, 'Dữ liệu không hợp lệ');
      if (d.type !== 'in' && d.type !== 'out') return bad(res, 'Loại phiếu không hợp lệ');
      if (!TIME_RE.test(String(d.time))) return bad(res, 'Ngày giờ không hợp lệ');
      if (!ID_RE.test(String(d.matId))) return bad(res, 'Vật liệu không hợp lệ');
      if (!money(d.price)) return bad(res, 'Đơn giá không hợp lệ');
      if (!(typeof d.qty === 'number' && isFinite(d.qty) && d.qty > 0 && d.qty <= 1e9)) return bad(res, 'Khối lượng không hợp lệ');
      const id = newId();
      try {
        await db.q('INSERT INTO entries (id,type,entry_time,material_id,price,qty,note,created_by) VALUES (?,?,?,?,?,?,?,?)',
          [id, d.type, db.toDb(d.time), d.matId, d.price, d.qty, String(d.note || '').slice(0, 255), s.user]);
      } catch (e) { if (e.code === 'ER_NO_REFERENCED_ROW_2') return bad(res, 'Vật liệu không tồn tại'); throw e; }
      return json(res, 200, { ok: true, id });
    }
    if (M === 'POST' && url === '/api/entries/bulk') {
      const d = await readJson(req);
      if (!d || !Array.isArray(d.items)) return bad(res, 'Dữ liệu không hợp lệ');
      let count = 0;
      for (const row of d.items) {
        if (row.type !== 'in' && row.type !== 'out') continue;
        if (!TIME_RE.test(String(row.time)) || !ID_RE.test(String(row.matId))) continue;
        if (!money(row.price) || !(typeof row.qty === 'number' && isFinite(row.qty) && row.qty > 0 && row.qty <= 1e9)) continue;
        try {
          await db.q('INSERT INTO entries (id,type,entry_time,material_id,price,qty,note,created_by) VALUES (?,?,?,?,?,?,?,?)',
            [newId(), row.type, db.toDb(row.time), row.matId, row.price, row.qty, String(row.note || '').slice(0, 255), s.user]);
          count++;
        } catch (e) { /* ignore single error */ }
      }
      return json(res, 200, { ok: true, count });
    }
    m = /^\/api\/entries\/([a-zA-Z0-9]{1,32})$/.exec(url);
    if (m && M === 'DELETE') {
      await db.q('DELETE FROM entries WHERE id=?', [m[1]]);
      audit(`ENTRY_DEL ${m[1]} by ${s.user}`, req);
      return json(res, 200, { ok: true });
    }

    // --- Tài khoản (chỉ quản trị) ---
    if (url === '/api/users' || url.startsWith('/api/users/')) {
      if (!isAdmin) return json(res, 403, { error: 'Forbidden' });
      if (M === 'POST' && url === '/api/users') {
        const d = await readJson(req, 4096); if (!d) return bad(res, 'Dữ liệu không hợp lệ');
        const name = String(d.username || ''), pw = String(d.password || '');
        if (!U.NAME_RE.test(name)) return bad(res, 'Tên 3-32 ký tự: chữ, số, _ . -');
        if (pw.length < U.MIN_PW || pw.length > 128) return bad(res, `Mật khẩu từ ${U.MIN_PW} đến 128 ký tự`);
        if (await U.getUser(name)) return json(res, 409, { error: 'Tài khoản đã tồn tại' });
        const role = d.role === 'admin' ? 'admin' : 'user';
        await U.createUser(name, pw, role);
        audit(`USER_ADD ${name} (${role}) by ${s.user}`, req);
        return json(res, 200, { ok: true });
      }
      m = /^\/api\/users\/([a-zA-Z0-9_.-]{3,32})(\/password)?$/.exec(url);
      if (!m || !(await U.getUser(m[1]))) return json(res, 404, { error: 'Không tìm thấy tài khoản' });
      const name = m[1];
      if (M === 'DELETE' && !m[2]) {
        if (name === s.user) return bad(res, 'Không thể tự xóa tài khoản đang dùng');
        await U.removeUser(name); dropSessions(name);
        audit(`USER_DEL ${name} by ${s.user}`, req);
        return json(res, 200, { ok: true });
      }
      if (M === 'POST' && m[2]) {
        const d = await readJson(req, 4096); if (!d) return bad(res, 'Dữ liệu không hợp lệ');
        const pw = String(d.password || '');
        if (pw.length < U.MIN_PW || pw.length > 128) return bad(res, `Mật khẩu từ ${U.MIN_PW} đến 128 ký tự`);
        await U.setPassword(name, pw);
        if (name !== s.user) dropSessions(name); // buộc người kia đăng nhập lại
        audit(`USER_PASSWD ${name} by ${s.user}`, req);
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'Method Not Allowed' });
    }
    return json(res, 404, { error: 'not found' });
  }

  if (req.method !== 'GET') return send(res, 405, 'Method Not Allowed');
  const f = FILES[url];
  if (!f) return s ? send(res, 404, 'Not found') : send(res, 302, '', 'text/plain', { Location: '/login' });
  const [file, type, needAuth] = f;
  if (needAuth && !s) return send(res, 302, '', 'text/plain', { Location: '/login' });
  if (url === '/login' && s) return send(res, 302, '', 'text/plain', { Location: '/' });
  send(res, 200, fs.readFileSync(path.join(__dirname, file)), type);
}

(async () => {
  try { await db.init(); }
  catch (e) {
    console.log(`\nKHÔNG kết nối được MySQL (${db.cfg.host}:${db.cfg.port}, user ${db.cfg.user}): ${e.message}`);
    console.log('Hãy bật MySQL (XAMPP -> Start MySQL) và kiểm tra file .env, rồi chạy lại.\n');
    process.exit(1);
  }
  const cb = (req, res) => handle(req, res).catch(e => { console.error(e); try { send(res, 500, JSON.stringify({ error: 'Lỗi máy chủ' }), 'application/json'); } catch {} });
  const srv = TLS
    ? https.createServer({ key: fs.readFileSync(process.env.TLS_KEY), cert: fs.readFileSync(process.env.TLS_CERT) }, cb)
    : http.createServer(cb);
  srv.listen(PORT, HOST, async () => {
    console.log(`Chạy tại ${TLS ? 'https' : 'http'}://${HOST}:${PORT}  (MySQL: ${db.cfg.database})`);
    if (!(await U.countUsers())) console.log('CHƯA có tài khoản. Tạo bằng: node users.js add <tên>');
    if (!TLS && HOST !== '127.0.0.1') console.log('CẢNH BÁO: đang mở ra mạng mà không có HTTPS, mật khẩu có thể bị nghe lén.');
  });
})();

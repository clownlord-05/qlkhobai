// Tài khoản trong MySQL. CLI: node users.js add|passwd|remove|list [tên] [--admin]
const crypto = require('crypto');
const db = require('./db');
const P = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 128 * 1024 * 1024 };
const NAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const MIN_PW = 12;

const hash = (password, salt) => crypto.scryptSync(password, salt, P.keylen, P).toString('hex');
const makeRecord = password => {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hash(password, salt) };
};
async function getUser(name) {
  const r = await db.q('SELECT username,salt,hash,role,created FROM users WHERE username=?', [name]);
  return r[0] || null;
}
const listUsers = () => db.q('SELECT username,role,created FROM users ORDER BY created, username');
const countUsers = async () => (await db.q('SELECT COUNT(*) n FROM users'))[0].n;
async function createUser(name, pw, role) {
  const r = makeRecord(pw);
  await db.q('INSERT INTO users (username,salt,hash,role) VALUES (?,?,?,?)', [name, r.salt, r.hash, role === 'admin' ? 'admin' : 'user']);
}
async function setPassword(name, pw) {
  const r = makeRecord(pw);
  await db.q('UPDATE users SET salt=?, hash=? WHERE username=?', [r.salt, r.hash, name]);
}
const removeUser = name => db.q('DELETE FROM users WHERE username=?', [name]);
async function verify(username, password) {
  const u = await getUser(username);
  // luôn tính hash kể cả khi user không tồn tại -> tránh dò tên tài khoản bằng thời gian
  const h = Buffer.from(hash(password, u ? u.salt : 'a'.repeat(32)), 'hex');
  const expect = Buffer.from(u ? u.hash : '0'.repeat(P.keylen * 2), 'hex');
  return crypto.timingSafeEqual(h, expect) && !!u;
}
module.exports = { verify, getUser, listUsers, countUsers, createUser, setPassword, removeUser, NAME_RE, MIN_PW };

if (require.main === module) {
  const args = process.argv.slice(2);
  const wantAdmin = args.includes('--admin');
  const [cmd, name, pwArg] = args.filter(a => a !== '--admin');
  const ask = qs => new Promise(res => {
    process.stdout.write(qs);
    const rl = require('readline').createInterface({ input: process.stdin, terminal: false });
    rl.question('', a => { rl.close(); res(a); });
  });
  (async () => {
    await db.init();
    if (cmd === 'list') { (await listUsers()).forEach(u => console.log(u.username + (u.role === 'admin' ? '  (admin)' : ''))); return; }
    if (!name || !NAME_RE.test(name)) return console.log('Dùng: node users.js add|passwd|remove|list <tên 3-32 ký tự a-z 0-9 _ . -> [--admin]');
    const exist = await getUser(name);
    if (cmd === 'remove') {
      if (!exist) return console.log('Không có tài khoản này');
      await removeUser(name); return console.log('Đã xóa ' + name);
    }
    if (cmd !== 'add' && cmd !== 'passwd') return console.log('Lệnh không hợp lệ');
    if (cmd === 'add' && exist) return console.log('Tài khoản đã tồn tại (dùng passwd để đổi mật khẩu)');
    if (cmd === 'passwd' && !exist) return console.log('Không có tài khoản này');
    const pw = pwArg || await ask(`Mật khẩu (tối thiểu ${MIN_PW} ký tự): `);
    if (pw.length < MIN_PW) return console.log('Mật khẩu quá ngắn');
    if (cmd === 'passwd') { await setPassword(name, pw); return console.log('Đã đổi mật khẩu ' + name); }
    const role = wantAdmin || (await countUsers()) === 0 ? 'admin' : 'user'; // tài khoản đầu tiên luôn là admin
    await createUser(name, pw, role);
    console.log(`Đã lưu tài khoản ${name} (${role})`);
  })().catch(e => console.log('Lỗi:', e.message)).finally(() => process.exit());
}

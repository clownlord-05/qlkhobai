const fs = require('fs'), path = require('path');
const root = 'd:/qlkhobai';
process.chdir(path.join(root, 'scratch_xl'));
const ExcelJS = require('exceljs');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pick = n => new RegExp(`function ${n}\\([^]*?\\n}\\n`).exec(app)[0];
const line = n => new RegExp(`^const ${n}=.*$`, 'm').exec(app)[0];
const els = { fMode: { value: process.argv[2] || 'month' }, fVal: { value: process.argv[3] || '2026-10' } };
let out;
global.ExcelJS = ExcelJS;
global.$ = id => els[id];
global.ME = { user: 'tester', role: 'admin' };
global.db = {
  mats: [{ id: 'a', name: 'đồng', price: 98000 }, { id: 'b', name: 'sắt', price: 123 }],
  entries: [
    { id: '1', type: 'in', time: '2026-10-05T09:30', matId: 'a', price: 98000, qty: 12.5, note: 'lô 1' },
    { id: '2', type: 'in', time: '2026-10-05T14:05', matId: 'b', price: 123, qty: 1123, note: '' },
    { id: '3', type: 'out', time: '2026-10-06T08:00', matId: 'a', price: 105000, qty: 5, note: 'bán' },
    { id: '4', type: 'in', time: '2026-09-30T08:00', matId: 'a', price: 90000, qty: 1, note: 'tháng trước' }
  ],
  hist: [{ time: '2026-10-01T08:00', matId: 'a', old: null, new: 95000 }, { time: '2026-10-05T08:00', matId: 'a', old: 95000, new: 98000 }]
};
global.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
global.URL = { createObjectURL: b => { out = b; return 'x' }, revokeObjectURL() {} };
global.Blob = class { constructor(p) { this.p = p } };
const code = [line('pad'), line('show'), line('esc'), line('matName'), pick('filtered'), pick('periodLabel'), pick('summarize'), fs.readFileSync(path.join(root, 'export.js'), 'utf8'), 'global.exportExcel=exportExcel;'].join('\n');
eval(code);
exportExcel().then(async () => {
  const buf = Buffer.from(out.p[0]);
  fs.writeFileSync(path.join(root, 'scratch_xl', `test_${els.fMode.value}.xlsx`), buf);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  wb.eachSheet(ws => {
    console.log('== ' + ws.name, ws.rowCount, 'rows');
    ws.eachRow((r, n) => console.log(n, JSON.stringify(r.values.slice(1).map(v => v && v.formula ? '=' + v.formula + '→' + v.result : (v instanceof Date ? v.toISOString() : v)))));
  });
}).catch(e => { console.error('ERR', e); process.exit(1) });

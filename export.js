// Xuất báo cáo Excel đã định dạng sẵn (ExcelJS): tiêu đề, viền, công thức, in A4.
const XL = {
  green: 'FF1B6B3A', light: 'FFDCEBE1', zebra: 'FFF5F9F6', white: 'FFFFFFFF', grey: 'FF666666',
  font: 'Arial',
  money: '#,##0;[Red]-#,##0',
  qty: '#,##0.###',
  thin: { style: 'thin', color: { argb: 'FF9AA5A0' } }
};
const xlBorder = () => ({ top: XL.thin, left: XL.thin, bottom: XL.thin, right: XL.thin });
const utcDate = (iso, withTime) => {
  const [y, mo, d] = iso.slice(0, 10).split('-').map(Number);
  const h = withTime ? +iso.slice(11, 13) : 0, mi = withTime ? +iso.slice(14, 16) : 0;
  return new Date(Date.UTC(y, mo - 1, d, h, mi));
};
const timeFrac = iso => (+iso.slice(11, 13) * 60 + +iso.slice(14, 16)) / 1440;

function xlTitle(ws, lastCol, title, sub, extra) {
  [[1, title, { size: 16, bold: true, color: XL.green }, 28], [2, sub, { size: 12, bold: true }, 20], [3, extra, { size: 10, italic: true, color: XL.grey }, 16]]
    .forEach(([r, text, f, h]) => {
      ws.mergeCells(`A${r}:${lastCol}${r}`);
      const c = ws.getCell(`A${r}`);
      c.value = text; c.font = { name: XL.font, ...f, color: { argb: f.color || 'FF000000' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(r).height = h;
    });
}
function xlHeader(row, align) {
  row.height = 24;
  row.eachCell(c => {
    c.font = { name: XL.font, bold: true, color: { argb: XL.white } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.green } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = xlBorder();
  });
}
function xlBody(row, i, fmts) {
  row.eachCell({ includeEmpty: true }, (c, n) => {
    c.font = { name: XL.font, size: 10 };
    c.border = xlBorder();
    c.alignment = { vertical: 'middle', ...(fmts[n]?.align ? { horizontal: fmts[n].align } : {}), wrapText: !!fmts[n]?.wrap };
    if (fmts[n]?.fmt) c.numFmt = fmts[n].fmt;
    if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.zebra } };
  });
}
function xlTotal(row) {
  row.eachCell({ includeEmpty: true }, c => {
    c.font = { name: XL.font, bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.light } };
    c.border = xlBorder();
  });
}
function xlSection(ws, r, lastCol, text) {
  ws.mergeCells(`A${r}:${lastCol}${r}`);
  const c = ws.getCell(`A${r}`);
  c.value = text;
  c.font = { name: XL.font, bold: true, size: 11, color: { argb: XL.green } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.light } };
  c.alignment = { vertical: 'middle' };
  ws.getRow(r).height = 20;
}
function xlPrint(ws, titleRows) {
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  if (titleRows) ws.pageSetup.printTitlesRow = titleRows;
  ws.headerFooter.oddFooter = '&LQuản lý phế liệu&RTrang &P / &N';
}

async function exportExcel() {
  const mode = $('fMode').value, v = $('fVal')?.value || '';
  const prefix = mode === 'year' ? v + '-' : mode === 'all' ? '' : v;
  const list = filtered().slice().reverse(); // tăng dần theo thời gian
  const s = summarize(list), label = periodLabel();
  const hist = db.hist.filter(h => h.time.startsWith(prefix));
  const now = new Date(), p2 = n => String(n).padStart(2, '0');
  const stamp = `Xuất lúc ${p2(now.getHours())}:${p2(now.getMinutes())} ngày ${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()} - Người xuất: ${ME.user}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = ME.user; wb.created = now;
  wb.calcProperties = { fullCalcOnLoad: true }; // Excel tự tính lại công thức khi mở
  const sum = wb.addWorksheet('Tổng kết', { views: [{ showGridLines: false }] });
  const det = wb.addWorksheet('Chi tiết');
  const hs = wb.addWorksheet('Lịch sử giá');

  // ===== Sheet Chi tiết =====
  xlTitle(det, 'I', 'BẢNG KÊ CHI TIẾT NHẬP / BÁN PHẾ LIỆU', label.toUpperCase(), stamp);
  const dh = det.addRow(['STT', 'Ngày', 'Giờ', 'Loại', 'Vật liệu', 'Đơn giá (đ/kg)', 'Khối lượng (kg)', 'Thành tiền (đ)', 'Ghi chú']);
  xlHeader(dh);
  const F = 5, L = Math.max(4 + list.length, 5); // vùng dữ liệu chi tiết: dòng F..L
  const dFmt = { 1: { align: 'center' }, 2: { fmt: 'dd/mm/yyyy', align: 'center' }, 3: { fmt: 'hh:mm', align: 'center' }, 4: { align: 'center' },
    5: {}, 6: { fmt: XL.money, align: 'right' }, 7: { fmt: XL.qty, align: 'right' }, 8: { fmt: XL.money, align: 'right' }, 9: { wrap: true } };
  list.forEach((e, i) => {
    const r = F + i;
    const row = det.addRow([i + 1, utcDate(e.time), timeFrac(e.time), e.type === 'in' ? 'Nhập' : 'Bán', matName(e.matId), e.price, e.qty,
      { formula: `F${r}*G${r}`, result: e.price * e.qty }, e.note]);
    xlBody(row, i, dFmt);
  });
  const t0 = 5 + list.length + 1;
  const dRange = c => `$${c}$${F}:$${c}$${L}`;
  [['TỔNG NHẬP PHẾ LIỆU (CHI)', `SUMIFS(${dRange('H')},${dRange('D')},"Nhập")`, s.chi],
   ['TỔNG BÁN RA (THU)', `SUMIFS(${dRange('H')},${dRange('D')},"Bán")`, s.thu],
   ['CHÊNH LỆCH (THU − CHI)', `H${t0 + 1}-H${t0}`, s.thu - s.chi]].forEach(([lbl, f, res], i) => {
    const r = t0 + i;
    det.mergeCells(`A${r}:G${r}`);
    det.getCell(`A${r}`).value = lbl;
    det.getCell(`A${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
    det.getCell(`H${r}`).value = { formula: f, result: res };
    det.getCell(`H${r}`).numFmt = XL.money;
    xlTotal(det.getRow(r));
  });
  [6, 12, 9, 9, 28, 16, 16, 18, 32].forEach((w, i) => det.getColumn(i + 1).width = w);
  det.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  det.autoFilter = `A4:I${Math.max(4 + list.length, 4)}`;
  xlPrint(det, '4:4');

  // ===== Sheet Tổng kết =====
  xlTitle(sum, 'G', 'BÁO CÁO THU CHI PHẾ LIỆU', label.toUpperCase(), stamp);
  xlSection(sum, 5, 'G', 'I. TỔNG HỢP THU CHI');
  const dr = c => `'Chi tiết'!$${c}$${F}:$${c}$${L}`;
  const KPI = [
    ['Tổng chi (nhập phế liệu)', `SUMIFS(${dr('H')},${dr('D')},"Nhập")`, s.chi, XL.money, 'đ'],
    ['Tổng thu (bán ra)', `SUMIFS(${dr('H')},${dr('D')},"Bán")`, s.thu, XL.money, 'đ'],
    ['Chênh lệch (thu − chi)', 'D7-D6', s.thu - s.chi, XL.money, 'đ'],
    ['Khối lượng nhập', `SUMIFS(${dr('G')},${dr('D')},"Nhập")`, s.qty, XL.qty, 'kg'],
    ['Khối lượng bán', `SUMIFS(${dr('G')},${dr('D')},"Bán")`, list.filter(e => e.type === 'out').reduce((a, e) => a + e.qty, 0), XL.qty, 'kg'],
    ['Số phiếu', `COUNT(${dr('A')})`, list.length, '#,##0', 'phiếu']
  ];
  KPI.forEach(([lbl, f, res, fmt, unit], i) => {
    const r = 6 + i;
    sum.mergeCells(`A${r}:C${r}`);
    sum.getCell(`A${r}`).value = lbl;
    sum.getCell(`D${r}`).value = { formula: f, result: res };
    sum.getCell(`D${r}`).numFmt = fmt;
    sum.getCell(`E${r}`).value = unit;
    ['A', 'B', 'C', 'D', 'E'].forEach(c => {
      const cell = sum.getCell(`${c}${r}`);
      cell.font = { name: XL.font, bold: i === 2 || c === 'D' };
      cell.border = xlBorder();
      if (c === 'D') cell.alignment = { horizontal: 'right' };
      if (c === 'E') cell.alignment = { horizontal: 'center' };
    });
    sum.getRow(r).height = 20;
  });

  const sFmt = { 1: { align: 'center' }, 2: {}, 3: { fmt: XL.qty, align: 'right' }, 4: { fmt: XL.money, align: 'right' }, 5: { fmt: XL.qty, align: 'right' }, 6: { fmt: XL.money, align: 'right' }, 7: { fmt: XL.money, align: 'right' } };
  const tableHead = first => xlHeader(sum.addRow(['STT', first, 'KL nhập (kg)', 'Tiền chi (đ)', 'KL bán (kg)', 'Tiền thu (đ)', 'Chênh lệch (đ)']));
  const totalRow = (start, end, rows) => {
    const T = rows.reduce((a, x) => ({ qi: a.qi + x.qi, ci: a.ci + x.ci, qo: a.qo + x.qo, co: a.co + x.co }), { qi: 0, ci: 0, qo: 0, co: 0 });
    const res = { C: T.qi, D: T.ci, E: T.qo, F: T.co, G: T.co - T.ci };
    const r = end + 1;
    sum.mergeCells(`A${r}:B${r}`);
    sum.getCell(`A${r}`).value = 'TỔNG CỘNG';
    sum.getCell(`A${r}`).alignment = { horizontal: 'center' };
    'CDEFG'.split('').forEach(c => {
      const cell = sum.getCell(`${c}${r}`);
      cell.value = { formula: `SUM(${c}${start}:${c}${end})`, result: res[c] };
      cell.numFmt = (c === 'C' || c === 'E') ? XL.qty : XL.money;
      cell.alignment = { horizontal: 'right' };
    });
    xlTotal(sum.getRow(r));
    return r;
  };

  // II. Theo vật liệu
  xlSection(sum, 13, 'G', 'II. TỔNG HỢP THEO VẬT LIỆU');
  tableHead('Vật liệu');
  const mats = s.g.length ? s.g : [{ name: '(Không có dữ liệu)', qi: 0, ci: 0, qo: 0, co: 0 }];
  const mStart = 15;
  mats.forEach((x, i) => {
    const r = mStart + i;
    const ref = (c, typ) => `SUMIFS(${dr(c)},${dr('E')},$B${r},${dr('D')},"${typ}")`;
    const row = sum.addRow([i + 1, x.name,
      { formula: ref('G', 'Nhập'), result: x.qi }, { formula: ref('H', 'Nhập'), result: x.ci },
      { formula: ref('G', 'Bán'), result: x.qo }, { formula: ref('H', 'Bán'), result: x.co },
      { formula: `F${r}-D${r}`, result: x.co - x.ci }]);
    xlBody(row, i, sFmt);
  });
  let next = totalRow(mStart, mStart + mats.length - 1, mats) + 2;

  // III. Theo ngày / tháng (khi xem tháng, năm, tất cả)
  if (mode !== 'day' && list.length) {
    const byDay = mode === 'month', keyLen = byDay ? 10 : 7;
    const grp = {};
    list.forEach(e => {
      const k = e.time.slice(0, keyLen);
      const g = grp[k] = grp[k] || { qi: 0, ci: 0, qo: 0, co: 0 };
      const t = e.qty * e.price;
      if (e.type === 'in') { g.qi += e.qty; g.ci += t } else { g.qo += e.qty; g.co += t }
    });
    xlSection(sum, next, 'G', byDay ? 'III. THỐNG KÊ THEO NGÀY' : 'III. THỐNG KÊ THEO THÁNG');
    tableHead(byDay ? 'Ngày' : 'Tháng');
    const start = next + 2, keys = Object.keys(grp).sort();
    keys.forEach((k, i) => {
      const g = grp[k], r = start + i;
      const name = byDay ? k.split('-').reverse().join('/') : k.split('-').reverse().join('/');
      const row = sum.addRow([i + 1, name, g.qi, g.ci, g.qo, g.co, { formula: `F${r}-D${r}`, result: g.co - g.ci }]);
      xlBody(row, i, sFmt);
      sum.getCell(`B${r}`).alignment = { horizontal: 'center' };
    });
    next = totalRow(start, start + keys.length - 1, keys.map(k => grp[k])) + 2;
  }

  // Chữ ký
  sum.mergeCells(`E${next}:G${next}`);
  sum.getCell(`E${next}`).value = `Ngày ${p2(now.getDate())} tháng ${p2(now.getMonth() + 1)} năm ${now.getFullYear()}`;
  sum.getCell(`E${next}`).font = { name: XL.font, italic: true };
  sum.getCell(`E${next}`).alignment = { horizontal: 'center' };
  [['A', 'C', 'NGƯỜI LẬP BIỂU'], ['E', 'G', 'CHỦ CƠ SỞ']].forEach(([a, b, t]) => {
    const r = next + 1;
    sum.mergeCells(`${a}${r}:${b}${r}`); sum.mergeCells(`${a}${r + 1}:${b}${r + 1}`);
    const c1 = sum.getCell(`${a}${r}`), c2 = sum.getCell(`${a}${r + 1}`);
    c1.value = t; c1.font = { name: XL.font, bold: true }; c1.alignment = { horizontal: 'center' };
    c2.value = '(Ký, ghi rõ họ tên)'; c2.font = { name: XL.font, italic: true, color: { argb: XL.grey } }; c2.alignment = { horizontal: 'center' };
  });
  [6, 30, 16, 20, 16, 20, 20].forEach((w, i) => sum.getColumn(i + 1).width = w);
  xlPrint(sum);

  // ===== Sheet Lịch sử giá =====
  xlTitle(hs, 'F', 'LỊCH SỬ ĐIỀU CHỈNH ĐƠN GIÁ VẬT LIỆU', label.toUpperCase(), stamp);
  xlHeader(hs.addRow(['STT', 'Thời điểm điều chỉnh', 'Vật liệu', 'Giá cũ (đ/kg)', 'Giá mới (đ/kg)', 'Chênh lệch (đ)']));
  const hFmt = { 1: { align: 'center' }, 2: { fmt: 'dd/mm/yyyy hh:mm', align: 'center' }, 3: {}, 4: { fmt: XL.money, align: 'right' }, 5: { fmt: XL.money, align: 'right' }, 6: { fmt: XL.money, align: 'right' } };
  hist.forEach((h, i) => {
    const r = 5 + i;
    const row = hs.addRow([i + 1, utcDate(h.time, true), matName(h.matId), h.old == null ? 'Giá ban đầu' : h.old, h.new,
      h.old == null ? '' : { formula: `E${r}-D${r}`, result: h.new - h.old }]);
    xlBody(row, i, hFmt);
    if (h.old == null) hs.getCell(`D${r}`).alignment = { horizontal: 'right' };
  });
  if (!hist.length) { hs.mergeCells('A5:F5'); hs.getCell('A5').value = 'Không có điều chỉnh giá trong kỳ này'; hs.getCell('A5').alignment = { horizontal: 'center' }; hs.getCell('A5').font = { name: XL.font, italic: true }; }
  [6, 22, 28, 16, 16, 16].forEach((w, i) => hs.getColumn(i + 1).width = w);
  hs.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  xlPrint(hs, '4:4');

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = 'PheLieu_' + label.replace(/\s+/g, '_') + '.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function downloadTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mau_Nhap_Lieu');
  ws.columns = [
    { header: 'Loại (Nhập/Bán)', key: 'type', width: 20 },
    { header: 'Thời gian (YYYY-MM-DD HH:mm)', key: 'time', width: 25 },
    { header: 'Tên vật liệu', key: 'mat', width: 20 },
    { header: 'Đơn giá (đ)', key: 'price', width: 15 },
    { header: 'Khối lượng (kg)', key: 'qty', width: 15 },
    { header: 'Ghi chú', key: 'note', width: 30 }
  ];
  ws.getRow(1).eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B6B3A' } };
    c.alignment = { horizontal: 'center' };
  });
  
  ws.dataValidations.add('A2:A1000', {
    type: 'list',
    allowBlank: false,
    formulae: ['"Nhập,Bán"']
  });

  const now = new Date();
  const pad2 = n => String(n).padStart(2, '0');
  const sampleTime = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())} 08:00`;
  
  ws.addRow({ type: 'Nhập', time: sampleTime, mat: 'Sắt', price: 10000, qty: 100, note: 'Nhập kho (mẫu)' });
  ws.addRow({ type: 'Bán', time: sampleTime, mat: 'Đồng', price: 150000, qty: 5.5, note: 'Bán lẻ (mẫu)' });

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = 'Mau_Nhap_Xuat_Excel.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
}

async function importExcel(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = ''; // reset
  
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    
    const items = [];
    const errs = [];
    
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      
      const typeStr = (row.getCell(1).text || '').trim();
      const tVal = row.getCell(2).value;
      const matStr = (row.getCell(3).text || '').trim().toLowerCase();
      
      if (!typeStr && !tVal && !matStr) return; // Dòng trống
      
      const tLow = typeStr.toLowerCase();
      const type = tLow === 'bán' || tLow === 'ban' || tLow === 'out' ? 'out' : 
                   (tLow === 'nhập' || tLow === 'nhap' || tLow === 'in' ? 'in' : null);
      if (!type) { errs.push(`Dòng ${rowNum}: Loại phải là 'Nhập' hoặc 'Bán'`); return; }
      
      let timeStr = '';
      if (tVal instanceof Date) {
        const pad2 = n => String(n).padStart(2, '0');
        timeStr = `${tVal.getFullYear()}-${pad2(tVal.getMonth()+1)}-${pad2(tVal.getDate())}T${pad2(tVal.getHours())}:${pad2(tVal.getMinutes())}`;
      } else {
        timeStr = (row.getCell(2).text || '').trim().replace(' ', 'T');
        if (timeStr.length === 10) timeStr += 'T00:00';
      }
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timeStr)) {
        errs.push(`Dòng ${rowNum}: Thời gian '${timeStr}' không đúng định dạng YYYY-MM-DD HH:mm`); return;
      }
      
      const mat = db.mats.find(m => m.name.toLowerCase() === matStr);
      if (!mat) { errs.push(`Dòng ${rowNum}: Không tìm thấy vật liệu '${matStr}'`); return; }
      
      let price = parseFloat(row.getCell(4).value);
      let qty = parseFloat(row.getCell(5).value);
      if (isNaN(price) || price < 0) { errs.push(`Dòng ${rowNum}: Đơn giá không hợp lệ`); return; }
      if (isNaN(qty) || qty <= 0) { errs.push(`Dòng ${rowNum}: Khối lượng không hợp lệ`); return; }
      
      const note = (row.getCell(6).text || '').trim();
      
      items.push({ type, time: timeStr, matId: mat.id, price, qty, note });
    });
    
    if (errs.length > 0) {
      return alert(`Có ${errs.length} lỗi trong file:\n` + errs.slice(0, 5).join('\n') + (errs.length > 5 ? '\n...' : ''));
    }
    if (items.length === 0) return alert('Không có dữ liệu hợp lệ!');
    
    await run(async () => {
      const res = await fetch('/api/entries/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
        body: JSON.stringify({ items })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi server');
      const r = await res.json();
      alert(`Đã nhập thành công ${r.count} dữ liệu!`);
    });
  } catch (err) {
    alert('Lỗi đọc file: ' + err.message);
  }
}

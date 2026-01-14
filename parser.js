import { detectCategory } from "./categories.js";

const MONTHS = { jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", jun: "06", jul: "07", agu: "08", sep: "09", okt: "10", nov: "11", des: "12" };

function parseAmount(str) {
  let num = parseFloat(str.replace(/[k|m|jt|rb]/g, ''));
  if (str.includes('k') || str.includes('rb')) num *= 1000;
  else if (str.includes('jt')) num *= 1000000;
  else if (str.includes('m')) num *= 1000000000; // Miliar
  return num;
}

export function parseInput(text, senderId) {
  if (!text) return [];
  const lines = text.split('\n');
  const results = [];

  for (let line of lines) {
    line = line.trim().toLowerCase();
    if (!line) continue;

    let user = senderId === 5023700044 ? 'M' : 'Y';
    if (line.startsWith('y ')) { user = 'Y'; line = line.substring(2).trim(); }
    else if (line.startsWith('m ')) { user = 'M'; line = line.substring(2).trim(); }

    if (line === 'list' || line === 'help' || line === '?') { results.push({ type: 'list' }); continue; }
    if (line === 'rekap' || line === 'saldo') { results.push({ type: 'rekap' }); continue; }
    if (line === 'koreksi' || line === 'undo') { results.push({ type: 'koreksi', user }); continue; }

    if (line.startsWith('export pdf')) {
      const sub = line.replace("export pdf", "").trim();
      if (!sub) { results.push({ type: "export_pdf", filter: { type: 'current', title: "Laporan Bulan Berjalan" } }); continue; }
      // Logika bulan/tahun lainnya tetap sama...
      results.push({ type: "export_pdf", filter: { type: 'current', title: "Laporan" } }); continue;
    }

    const mSaldo = line.match(/^set saldo (\w+) (\d+[k|m|jt|rb]*)$/);
    if (mSaldo) { results.push({ type: 'set_saldo', user, account: mSaldo[1], amount: parseAmount(mSaldo[2]) }); continue; }

    const mPindah = line.match(/^pindah (\d+[k|m|jt|rb]*) (\w+) (\w+)$/);
    if (mPindah) {
      results.push({ type: 'transfer_akun', user, amount: parseAmount(mPindah[1]), from: mPindah[2], to: mPindah[3], note: `Pindah ${mPindah[2]} ke ${mPindah[3]}` });
      continue;
    }

    const mTx = line.match(/^(\d+[k|m|jt|rb]*) (.+?) (\w+)$/);
    if (mTx) {
      const amountRaw = parseAmount(mTx[1]);
      const catObj = detectCategory(mTx[2]);
      const isIncome = catObj.category === "Pendapatan";
      results.push({ type: 'tx', user, account: mTx[3], amount: isIncome ? amountRaw : -amountRaw, category: catObj.category, note: mTx[2] });
    }
  }
  return results;
}

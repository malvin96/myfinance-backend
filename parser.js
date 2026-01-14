import { detectCategory } from "./categories.js";

function parseAmount(str) {
  let num = parseFloat(str.replace(/[k|jt|rb]/g, ''));
  if (str.includes('k') || str.includes('rb')) num *= 1000;
  else if (str.includes('jt')) num *= 1000000;
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

    if (['list', 'help', '?'].includes(line)) { results.push({ type: 'list' }); continue; }
    if (['rekap', 'saldo'].includes(line)) { results.push({ type: 'rekap' }); continue; }
    if (['koreksi', 'undo'].includes(line)) { results.push({ type: 'koreksi', user }); continue; }
    if (line === 'backup') { results.push({ type: 'backup' }); continue; }
    if (line === 'export pdf') { results.push({ type: 'export_pdf', filter: { title: 'Laporan Bulanan' } }); continue; }

    const mSaldo = line.match(/^set saldo (\w+) (\d+[k|jt|rb]*)$/);
    if (mSaldo) { results.push({ type: 'set_saldo', user, account: mSaldo[1], amount: parseAmount(mSaldo[2]) }); continue; }

    const mPindah = line.match(/^pindah (\d+[k|jt|rb]*) (\w+) (\w+)$/);
    if (mPindah) {
      results.push({ type: 'transfer_akun', user, amount: parseAmount(mPindah[1]), from: mPindah[2], to: mPindah[3], note: `Pindah ${mPindah[2]} ke ${mPindah[3]}` });
      continue;
    }

    const mTx = line.match(/^(\d+[k|jt|rb]*) (.+?) (\w+)$/);
    if (mTx) {
      const amountRaw = parseAmount(mTx[1]);
      const category = detectCategory(mTx[2]);
      const amount = (category === "Pendapatan") ? Math.abs(amountRaw) : -Math.abs(amountRaw);
      results.push({ type: 'tx', user, amount, note: mTx[2], account: mTx[3], category });
    }
  }
  return results;
}

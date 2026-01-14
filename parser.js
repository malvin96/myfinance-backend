import { CATEGORIES } from './categories.js';

export function parseInput(text, senderId) {
  const lines = text.split('\n');
  const user = senderId === 5023700044 ? 'M' : 'Y';
  const results = [];

  for (let line of lines) {
    line = line.trim().toLowerCase();
    if (!line) continue;

    if (line === 'list' || line === 'help' || line === '?') {
      results.push({ type: 'list' });
      continue;
    }

    if (line === 'rekap' || line === 'saldo') {
      results.push({ type: 'rekap' });
      continue;
    }

    if (line === 'export pdf') {
      results.push({ type: 'export_pdf', filter: { title: 'Laporan Bulan Ini' } });
      continue;
    }

    if (line === 'koreksi' || line === 'undo') {
      results.push({ type: 'koreksi', user });
      continue;
    }

    // Match: set saldo [account] [amount]
    const mSaldo = line.match(/^set saldo (\w+) (\d+[k|m|jt|rb]*)$/);
    if (mSaldo) {
      results.push({ type: 'set_saldo', user, account: mSaldo[1], amount: parseAmount(mSaldo[2]) });
      continue;
    }

    // Match: pindah [amount] [from] [to] (FIXED TYPO)
    const mPindah = line.match(/^pindah (\d+[k|m|jt|rb]*) (\w+) (\w+)$/);
    if (mPindah) {
      results.push({ 
        type: 'transfer_akun', 
        user, 
        amount: parseAmount(mPindah[1]), 
        from: mPindah[2], 
        to: mPindah[3], 
        note: `Transfer ${mPindah[2]} ke ${mPindah[3]}` 
      });
      continue;
    }

    // Standard Transaction: [amount] [note] [account]
    const mTx = line.match(/^(\d+[k|m|jt|rb]*) (.+?) (\w+)$/);
    if (mTx) {
      const amountRaw = parseAmount(mTx[1]);
      const note = mTx[2].trim();
      const account = mTx[3];
      const category = detectCategory(note);
      
      // Default: Belanja (-) kecuali terdeteksi Pendapatan
      const amount = category === "Pendapatan" ? Math.abs(amountRaw) : -Math.abs(amountRaw);

      results.push({ type: 'tx', user, amount, note, account, category });
    }
  }
  return results;
}

function parseAmount(str) {
  let num = parseFloat(str.replace(/[k|m|jt|rb]/g, ''));
  if (str.includes('k') || str.includes('rb')) num *= 1000;
  else if (str.includes('jt')) num *= 1000000;
  else if (str.includes('m')) num *= 1000000; // Case for million
  return num;
}

function detectCategory(note) {
  for (const c of CATEGORIES) {
    if (c.keywords.some(k => note.toLowerCase().includes(k))) {
      return c.cat;
    }
  }
  return "Lainnya";
}

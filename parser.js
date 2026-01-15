import { detectCategory } from "./categories.js";

// --- KAMUS AKUN PINTAR (FINAL v5.2) ---
const ACCOUNT_MAP = {
  // LIQUID
  'bca': ['bca', 'mbca', 'm-bca', 'qris', 'qr', 'scan', 'transfer', 'debit'],
  'cash': ['cash', 'tunai', 'dompet', 'uang', 'kes', 'cash'],
  'gopay': ['gopay', 'gojek', 'gopy'],
  'ovo': ['ovo'],
  'shopeepay': ['shopeepay', 'shopee', 'spay', 'shope', 'shoppeepay'],
  
  // ASET / INVESTASI
  'bibit': ['bibit', 'reksadana', 'rdn'],
  'mirrae': ['mirrae', 'mirae', 'mire', 'saham', 'sekuritas'],
  'bca sekuritas': ['bca sekuritas', 'bcas', 'bca s', 'bcasekuritas'], 
  
  // LAINNYA
  'cc': ['cc', 'kartu kredit', 'credit card']
};

function normalizeAccount(raw) {
  if (!raw) return 'Lainnya';
  // Hapus karakter aneh dan spasi ganda
  const lower = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); 
  
  for (const [standard, aliases] of Object.entries(ACCOUNT_MAP)) {
    if (standard === lower || aliases.includes(lower)) return standard;
  }
  return lower; 
}

function parseAmount(str) {
  if (/[\+\-\*\/]/.test(str) && /\d/.test(str)) {
    try {
      let cleanExp = str.toLowerCase()
        .replace(/k|rb/g, '000')
        .replace(/jt/g, '000000')
        .replace(/[^0-9\+\-\*\/\.]/g, ''); 
      return eval(cleanExp); 
    } catch (e) { return 0; }
  }

  let cleanStr = str.replace(/[^0-9kjtbrb.,]/g, '');
  let num = parseFloat(cleanStr.replace(/[k|jt|rb]/g, ''));
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

    const cmd = line.split(' ')[0];

    // EXPORT PDF
    if (line.startsWith('export pdf') || line.startsWith('pdf')) { 
      let filter = { type: 'current', title: 'Laporan Bulan Ini', val: null };
      if (line.includes('hari') || line.includes('daily')) {
        const today = new Date().toISOString().slice(0, 10);
        filter = { type: 'day', title: `Laporan Harian (${today})`, val: today };
      } 
      else if (line.includes('minggu') || line.includes('week')) {
        filter = { type: 'week', title: 'Laporan 7 Hari Terakhir', val: null };
      }
      else if (line.includes('tahun') || line.includes('year')) {
        const year = new Date().getFullYear().toString();
        filter = { type: 'year', title: `Laporan Tahunan ${year}`, val: year };
      }
      else if (line.match(/\d{4}-\d{2}/)) { 
        const mDate = line.match(/(\d{4}-\d{2})/)[1];
        filter = { type: 'month', title: `Laporan Bulan ${mDate}`, val: mDate };
      }
      results.push({ type: 'export_pdf', filter }); continue; 
    }

    // MENU
    if (/^(help|menu|tolong|list|ls|\?)$/.test(cmd) && !line.includes('tx')) { 
      results.push({ type: 'list' }); continue; 
    }

    // HISTORY
    if (/^(history|hist|riwayat)$/.test(cmd)) {
      const limitMatch = line.match(/\d+/); 
      const limit = limitMatch ? parseInt(limitMatch[0]) : 10;
      results.push({ type: 'history', limit }); continue; 
    }

    // FITUR LAIN
    if (/^(rekap|rkap|rekp|reakp|saldo|sldo|sld|cek|balance)$/.test(cmd)) { results.push({ type: 'rekap' }); continue; }
    if (/^(koreksi|undo|batal|hapus|del|cancel)$/.test(line)) { results.push({ type: 'koreksi', user }); continue; }
    if (/^(backup|db|unduh)$/.test(line)) { results.push({ type: 'backup' }); continue; }

    // SET SALDO
    const mSaldo = line.match(/^set saldo (.+) (.+)$/); 
    if (mSaldo) { 
        results.push({ 
            type: 'set_saldo', 
            user, 
            account: normalizeAccount(mSaldo[1]), 
            amount: parseAmount(mSaldo[2]) 
        }); continue; 
    }
    
    // TRANSFER
    const mPindah = line.match(/^pindah (.+) (.+) (.+)$/); 
    if (mPindah) { 
        results.push({ 
            type: 'transfer_akun', 
            user, 
            amount: parseAmount(mPindah[1]), 
            from: normalizeAccount(mPindah[2]), 
            to: normalizeAccount(mPindah[3]),   
            note: `Pindah ${normalizeAccount(mPindah[2])} ke ${normalizeAccount(mPindah[3])}` 
        }); continue; 
    }

    // TRANSAKSI UMUM
    const tokens = line.split(/\s+/);
    const amountIdx = tokens.findIndex(t => /^[\d\.\+\-\*\/]+([.,]\d+)?[k|jt|rb]*$/i.test(t));
    
    if (amountIdx !== -1 && tokens.length >= 2) {
      const amountRaw = parseAmount(tokens[amountIdx]);
      const otherTokens = tokens.filter((_, i) => i !== amountIdx);
      let rawAccount = otherTokens.pop(); 
      let account = normalizeAccount(rawAccount);
      let note = otherTokens.join(' ');
      const category = detectCategory(note);
      if (!note) note = category;
      const amount = (category === "Pendapatan") ? Math.abs(amountRaw) : -Math.abs(amountRaw);
      results.push({ type: 'tx', user, amount, note, account, category });
    }
  }
  return results;
}

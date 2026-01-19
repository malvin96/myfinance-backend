import { detectCategory } from "./categories.js";

// --- KAMUS AKUN PINTAR ---
const ACCOUNT_MAP = {
  // LIQUID
  'bca': ['bca', 'mbca', 'm-bca', 'qris', 'qr', 'scan', 'transfer', 'debit'],
  'cash': ['cash', 'tunai', 'dompet', 'uang', 'kes', 'cash'],
  'gopay': ['gopay', 'gojek', 'gopy'],
  'ovo': ['ovo'],
  'shopeepay': ['shopeepay', 'shopee', 'spay', 'shope', 'shoppeepay'],
  
  // ASET
  'bibit': ['bibit', 'reksadana', 'rdn'],
  'mirrae': ['mirrae', 'mirae', 'mire', 'saham', 'sekuritas'],
  'bca sekuritas': ['bca sekuritas', 'bcas', 'bca s', 'bcasekuritas'], 
  
  // LAINNYA
  'cc': ['cc', 'kartu kredit', 'credit card']
};

function normalizeAccount(raw) {
  if (!raw) return 'Lainnya';
  const lower = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); 
  
  for (const [standard, aliases] of Object.entries(ACCOUNT_MAP)) {
    if (standard === lower || aliases.includes(lower)) return standard;
  }
  return lower; 
}

function parseAmount(str) {
  if (/[\+\-\*\/]/.test(str)) return null; 
  let numStr = str.toLowerCase().replace(/rp|\./g, '').replace(',', '.');
  let multiplier = 1;
  
  if (numStr.endsWith('jt')) { multiplier = 1000000; numStr = numStr.replace('jt',''); }
  else if (numStr.endsWith('juta')) { multiplier = 1000000; numStr = numStr.replace('juta',''); }
  else if (numStr.endsWith('k') || numStr.endsWith('rb') || numStr.endsWith('ribu')) { multiplier = 1000; numStr = numStr.replace(/k|rb|ribu/g,''); }
  
  const val = parseFloat(numStr);
  return isNaN(val) ? null : val * multiplier;
}

export function parseInput(text, senderName) {
  const line = text.trim();
  let user = 'M'; 
  if (senderName && senderName.toLowerCase().includes('yovita')) user = 'Y';

  // 1. HELP / MENU
  if (/^(menu|help|bantuan|\?)$/i.test(line)) return { type: 'help' };

  // 2. EXPORT & FILES
  if (/^(rekap|summary|saldo|balance)$/i.test(line)) return { type: 'rekap' };
  if (/^(xls|excel|csv)$/i.test(line)) return { type: 'export_xls' };
  if (/^(pdf|laporan|report)$/i.test(line)) return { type: 'export_pdf' };
  if (/^(backup|db)$/i.test(line)) return { type: 'backup_now' };

  // 3. EDIT & UNDO
  if (/^(koreksi|undo|batal|del|hapus)$/i.test(line)) return { type: 'koreksi', user };
  
  // 4. SET SALDO (Strict)
  const mSaldo = line.match(/^(?:set\s+saldo|ss)\s+(.+)\s+(.+)$/i); 
  if (mSaldo) { 
      return { 
          type: 'set_saldo', 
          user, 
          account: normalizeAccount(mSaldo[1]), 
          amount: parseAmount(mSaldo[2]) || 0
      };
  }

  // 5. HISTORY / RIWAYAT [BARU]
  // Format: history, history hari, history minggu
  const mHist = line.match(/^(?:history|riwayat|cek)(?:\s+(hari|minggu|bulan))?$/i);
  if (mHist) {
      let filter = 'day'; // Default hari ini
      if (mHist[1] === 'minggu') filter = 'week';
      if (mHist[1] === 'bulan') filter = 'month';
      return {
          type: 'history',
          filter: filter,
          val: new Date().toISOString().slice(0, 10) // Digunakan untuk filter hari/bulan di db.js
      };
  }

  // 6. TRANSFER
  const mPindah = line.match(/^(?:pindah|tf|mv|transfer)\s+(.+)\s+(.+)\s+(.+)$/i); 
  if (mPindah) {
      // Logic mendeteksi posisi angka
      const tokens = [mPindah[1], mPindah[2], mPindah[3]];
      const amountIdx = tokens.findIndex(t => parseAmount(t) !== null);
      
      if (amountIdx !== -1) {
          const amount = parseAmount(tokens[amountIdx]);
          const accounts = tokens.filter((_, i) => i !== amountIdx);
          return { 
              type: 'transfer_akun', 
              user, 
              amount: amount, 
              from: normalizeAccount(accounts[0]), 
              to: normalizeAccount(accounts[1])
          }; 
      }
  }

  // 7. TRANSAKSI BIASA
  const tokens = line.split(/\s+/);
  const amountIdx = tokens.findIndex(t => /^[0-9\.\,]+[k|jt|rb]*$/i.test(t)); // Simple regex
  
  // Regex lebih kuat untuk amount (seperti fungsi parseAmount)
  const realAmountIdx = tokens.findIndex(t => parseAmount(t) !== null);

  if (realAmountIdx !== -1 && tokens.length >= 2) {
    const amountRaw = parseAmount(tokens[realAmountIdx]);
    const otherTokens = tokens.filter((_, i) => i !== realAmountIdx);
    
    // Cek apakah kata pertama adalah akun
    let account = 'cash'; // Default
    let note = otherTokens.join(' ');
    
    // Cek token pertama apakah akun?
    const firstWord = otherTokens[0];
    const detectedAccount = normalizeAccount(firstWord);
    
    if (detectedAccount !== 'Lainnya' && detectedAccount !== firstWord.toLowerCase()) {
        // Jika firstWord dikenali sebagai alias akun yang valid
        account = detectedAccount;
        note = otherTokens.slice(1).join(' ');
    } else if (ACCOUNT_MAP[firstWord.toLowerCase()]) {
         // Jika exact match
         account = firstWord.toLowerCase();
         note = otherTokens.slice(1).join(' ');
    }

    const category = detectCategory(note);
    
    // Logika Expense vs Income
    let finalAmount = -Math.abs(amountRaw); // Default Pengeluaran
    if (category === 'Pendapatan') finalAmount = Math.abs(amountRaw);

    return {
      type: 'tx',
      user,
      account,
      amount: finalAmount,
      category,
      note
    };
  }

  return null;
}

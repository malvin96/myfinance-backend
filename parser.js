import { detectCategory } from "./categories.js";
import * as math from 'mathjs';

const ACCOUNT_MAP = {
  'bca': ['bca', 'mbca', 'm-bca', 'qris', 'qr', 'scan', 'transfer', 'debit'],
  'cash': ['cash', 'tunai', 'dompet', 'uang', 'kes', 'duit'],
  'gopay': ['gopay', 'gojek', 'gopy'],
  'ovo': ['ovo'],
  'shopeepay': ['shopeepay', 'shopee', 'spay'],
  'bibit': ['bibit', 'reksadana', 'rdn'],
  'mirrae': ['mirrae', 'mirae', 'mire', 'saham'],
  'bca sekuritas': ['bcas', 'bca sekuritas', 'bcasekuritas'], 
  'cc': ['cc', 'kartu kredit']
};

function parseAmount(str) {
  if (!str) return null;
  let s = str.toLowerCase().replace(/,/g, '.');
  s = s.replace(/jt/g, '*1000000').replace(/k/g, '*1000').replace(/rb/g, '*1000');
  try { return math.evaluate(s); } catch { return null; }
}

export function parseInput(line, userCode) {
  if (!line) return { type: 'error' };
  const low = line.toLowerCase().trim();
  const tokens = line.split(/\s+/);

  // 0. SYSTEM COMMANDS (Bypass Logic)
  // Ini penting agar perintah ini tidak masuk ke logika parser uang
  const sysCommands = ['koreksi', 'menu', 'sync', 'status', 'backup', 'rekap', 'cari', 'laporan', 'daily', 'history', 'export'];
  if (sysCommands.some(cmd => low.startsWith(cmd))) {
      return { type: 'system' }; 
  }

  // 1. Logika Set Saldo (ss)
  if (low.startsWith('ss ')) {
    const parts = line.split(' ');
    const amt = parseAmount(parts[parts.length - 1]);
    const accToken = parts[1].toLowerCase();
    const account = Object.keys(ACCOUNT_MAP).find(k => k === accToken || ACCOUNT_MAP[k].includes(accToken)) || 'cash';
    if (amt !== null) return { type: 'adjustment', tx: { user: userCode, account, amount: amt, category: 'Adjustment', note: 'Set Saldo' } };
  }

  // 2. Logika Transfer (tf)
  if (low.startsWith('tf ')) {
    const amtToken = tokens.find(t => parseAmount(t) !== null);
    if (amtToken) {
      const amt = parseAmount(amtToken);
      const parts = line.split(' ke ');
      if (parts.length === 2) {
        let fromAcc = Object.keys(ACCOUNT_MAP).find(k => parts[0].includes(k) || ACCOUNT_MAP[k].some(a => parts[0].includes(a))) || 'cash';
        let toAcc = Object.keys(ACCOUNT_MAP).find(k => parts[1].includes(k) || ACCOUNT_MAP[k].some(a => parts[1].includes(a))) || 'cash';
        let targetUser = userCode;
        if (parts[1].includes('yovita')) targetUser = 'Y';
        if (parts[1].includes('malvin')) targetUser = 'M';
        return {
          type: 'transfer',
          txOut: { user: userCode, account: fromAcc, amount: -amt, category: 'Transfer', note: `Ke ${targetUser === userCode ? toAcc : 'Partner'}` },
          txIn: { user: targetUser, account: toAcc, amount: amt, category: 'Transfer', note: `Dari ${userCode === 'M' ? 'Malvin' : 'Yovita'}` }
        };
      }
    }
  }

  // 3. Logika Transaksi Biasa
  const amountToken = tokens.find(t => parseAmount(t) !== null);
  if (!amountToken) return { type: 'error' };
  const amountRaw = parseAmount(amountToken);
  let account = 'cash'; 
  let noteTokens = tokens.filter(t => t !== amountToken);
  for (let i = 0; i < noteTokens.length; i++) {
    const t = noteTokens[i].toLowerCase().replace(/[^a-z0-9]+/g, '');
    const foundAcc = Object.keys(ACCOUNT_MAP).find(key => key === t || ACCOUNT_MAP[key].includes(t));
    if (foundAcc) {
      account = foundAcc;
      noteTokens.splice(i, 1);
      break;
    }
  }

  const note = noteTokens.join(' ');
  const category = detectCategory(note);
  const amount = (low.includes('masuk') || low.includes('terima') || category === 'Pendapatan') ? Math.abs(amountRaw) : -Math.abs(amountRaw);

  return { type: 'tx', tx: { user: userCode, account, amount, category, note } };
}

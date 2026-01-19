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
  const low = line.toLowerCase();
  const tokens = line.split(/\s+/);

  if (low === 'koreksi' || low === 'undo') return { type: 'koreksi' };

  // 1. SET SALDO (ss bca 10jt)
  if (low.startsWith('ss ')) {
    const amountToken = tokens.find(t => parseAmount(t) !== null);
    const accToken = tokens.find(t => t !== 'ss' && parseAmount(t) === null);
    if (amountToken) {
      const acc = Object.keys(ACCOUNT_MAP).find(k => accToken === k || ACCOUNT_MAP[k].includes(accToken)) || 'cash';
      return { type: 'adjustment', tx: { user: userCode, account: acc, amount: parseAmount(amountToken), category: 'Adjustment', note: 'Set Saldo' } };
    }
  }

  // 2. TRANSFER (tf bca ke cash 100k)
  if (low.includes(' ke ') || low.startsWith('tf ')) {
    const amountToken = tokens.find(t => parseAmount(t) !== null);
    if (amountToken) {
      const amt = parseAmount(amountToken);
      const parts = low.replace('tf ', '').split(' ke ');
      if (parts.length === 2) {
        const fromAcc = Object.keys(ACCOUNT_MAP).find(k => parts[0].includes(k) || ACCOUNT_MAP[k].some(a => parts[0].includes(a))) || 'cash';
        const toAcc = Object.keys(ACCOUNT_MAP).find(k => parts[1].includes(k) || ACCOUNT_MAP[k].some(a => parts[1].includes(a))) || 'cash';
        return {
          type: 'transfer',
          txOut: { user: userCode, account: fromAcc, amount: -amt, category: 'Transfer', note: `Ke ${toAcc}` },
          txIn: { user: userCode, account: toAcc, amount: amt, category: 'Transfer', note: `Dari ${fromAcc}` }
        };
      }
    }
  }

  // 3. TRANSAKSI BIASA (GREEDY)
  const amountToken = tokens.find(t => parseAmount(t) !== null);
  if (!amountToken) return { type: 'error' };

  const amountRaw = parseAmount(amountToken);
  let account = 'cash'; 
  let noteTokens = tokens.filter(t => t !== amountToken);

  for (let i = 0; i < noteTokens.length; i++) {
    const t = noteTokens[i].toLowerCase().replace(/[^a-z0-9]+/g, '');
    const foundAcc = Object.keys(ACCOUNT_MAP).find(key => key === t || ACCOUNT_MAP[key].includes(t));
    if (foundAcc) { account = foundAcc; noteTokens.splice(i, 1); break; }
  }

  const note = noteTokens.join(' ') || 'Tanpa catatan';
  const category = detectCategory(note);
  return { type: 'tx', category, tx: { user: userCode, account, amount: category === 'Pendapatan' ? Math.abs(amountRaw) : -Math.abs(amountRaw), category, note } };
}

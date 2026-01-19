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
  try {
    const result = math.evaluate(s);
    return isNaN(result) ? null : result;
  } catch { return null; }
}

export function parseInput(line, userCode) {
  if (!line) return { type: 'error' };
  const low = line.toLowerCase();
  const tokens = line.split(/\s+/);

  // 1. Logika Koreksi
  if (low === 'koreksi' || low === 'undo') return { type: 'koreksi' };

  // 2. Logika Transfer (tf bca ke cash 10k)
  if (low.includes(' ke ') || low.startsWith('tf ')) {
    const clean = low.replace('tf ', '');
    const parts = clean.split(' ke ');
    if (parts.length === 2) {
      const amountToken = tokens.find(t => parseAmount(t) !== null);
      if (amountToken) {
        const amt = parseAmount(amountToken);
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

  // 3. Logika SS (Set Saldo)
  if (low.startsWith('ss ')) {
    const amountToken = tokens.find(t => parseAmount(t) !== null);
    const accToken = tokens.find(t => t !== 'ss' && parseAmount(t) === null);
    if (amountToken) {
      return { type: 'adjustment', tx: { user: userCode, account: accToken || 'cash', amount: parseAmount(amountToken), category: 'Adjustment', note: 'Set Saldo' } };
    }
  }

  // 4. Logika Transaksi (Greedy Search)
  const amountToken = tokens.find(t => parseAmount(t) !== null);
  if (!amountToken) return { type: 'error' };

  const amountRaw = parseAmount(amountToken);
  let account = 'cash'; // Default
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

  const note = noteTokens.join(' ') || 'Tanpa catatan';
  const category = detectCategory(note);
  const finalAmount = category === 'Pendapatan' ? Math.abs(amountRaw) : -Math.abs(amountRaw);

  return { type: 'tx', category, tx: { user: userCode, account, amount: finalAmount, category, note } };
}

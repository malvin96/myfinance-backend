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

  if (low === 'koreksi' || low === 'undo') return { type: 'koreksi' };

  // GREEDY AMOUNT SEARCH
  const amountToken = tokens.find(t => parseAmount(t) !== null);
  if (!amountToken) return { type: 'error' };
  const amountRaw = parseAmount(amountToken);

  // GREEDY ACCOUNT SEARCH
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

  const note = noteTokens.join(' ') || 'Tanpa catatan';
  const category = detectCategory(note);
  const finalAmount = category === 'Pendapatan' ? Math.abs(amountRaw) : -Math.abs(amountRaw);

  return { type: 'tx', category, tx: { user: userCode, account, amount: finalAmount, category, note } };
}

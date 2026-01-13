import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import {
  initDB,
  addTx,
  getSaldo,
  getHistory,
  getLastTx,
  addCorrection,
} from "./db.js";
import {
  getRekapRaw,
  getRekapByFilter,
} from "./aggregate.js";
import {
  setBudget,
  getBudgetStatus,
} from "./budget.js";
import {
  addReminder,
} from "./reminder.js";
import {
  exportText,
} from "./export.js";

initDB();

const fmt = n => `Rp ${Number(n).toLocaleString("id-ID")}`;

async function handleMessage(msg) {
  const text = msg.text.trim();
  const p = parseInput(text);

  // ===== SALDO =====
  if (p.type === "saldo") {
    const s = getSaldo(p.account, true);
    return `💰 SALDO ${p.account.toUpperCase()}
━━━━━━━━━━━━
${fmt(s)}`;
  }

  // ===== REKAP =====
  if (p.type === "rekap") {
    const r = p.filter
      ? getRekapByFilter(p.filter)
      : getRekapRaw();

    return `📊 REKAP
━━━━━━━━━━━━
Pemasukan  : ${fmt(r.income)}
Pengeluaran: ${fmt(Math.abs(r.expense))}
━━━━━━━━━━━━
NET        : ${fmt(r.net)}`;
  }

  // ===== HISTORY =====
  if (p.type === "history") {
    const rows = getHistory(p.filter);
    if (!rows.length) return "📭 Tidak ada data";

    return rows.slice(0, 10).map(r =>
      `${r.ts} | ${r.user} | ${r.account.toUpperCase()} | ${fmt(r.amount)} | ${r.note}`
    ).join("\n");
  }

  // ===== EDIT TERAKHIR =====
  if (p.type === "edit") {
    const last = getLastTx(p.account);
    if (!last) return "⚠️ Tidak ada transaksi";

    addCorrection(last, p.newAmount);
    return "✏️ Transaksi dikoreksi";
  }

  // ===== BUDGET =====
  if (p.type === "set_budget") {
    setBudget(p.category, p.amount);
    return `🎯 Budget ${p.category} diset ${fmt(p.amount)}`;
  }

  if (p.type === "budget_status") {
    return getBudgetStatus(fmt);
  }

  // ===== REMINDER =====
  if (p.type === "reminder") {
    addReminder(p);
    return "⏰ Reminder disimpan";
  }

  // ===== EXPORT =====
  if (p.type === "export") {
    return exportText();
  }

  // ===== TRANSAKSI =====
  if (p.type === "tx") {
    addTx(p);
    const saldo = getSaldo(p.account, true);

    return `✅ TRANSAKSI
━━━━━━━━━━━━
User     : ${p.user}
Akun     : ${p.account.toUpperCase()}
Kategori : ${p.category}
Jumlah   : ${fmt(Math.abs(p.amount))}
━━━━━━━━━━━━
Saldo ${p.account.toUpperCase()}
${fmt(saldo)}`;
  }

  return "⚠️ Perintah tidak dikenali";
}

pollUpdates(handleMessage);
console.log("MY FINANCE BOT v2 RUNNING");

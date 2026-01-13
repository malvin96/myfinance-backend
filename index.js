import express from "express";
import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getHistory, getLastTx, addCorrection } from "./db.js";
import { getRekapRaw, getRekapByFilter } from "./aggregate.js";
import { setBudget, getBudgetStatus } from "./budget.js";
import { addReminder } from "./reminder.js";
import { exportText } from "./export.js";

// --- DUMMY SERVER UNTUK RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot Finance Aktif!"));
app.listen(PORT, () => console.log(`Render port binding aktif di port ${PORT}`));
// --------------------------------

initDB();
const fmt = n => `Rp ${Number(n).toLocaleString("id-ID")}`;

async function handleMessage(msg) {
  const text = msg.text.trim();
  const p = parseInput(text);

  if (p.type === "saldo") {
    const s = getSaldo(p.account, true);
    return `💰 SALDO ${p.account.toUpperCase()}\n━━━━━━━━━━━━\n${fmt(s)}`;
  }

  if (p.type === "rekap") {
    const r = p.filter ? getRekapByFilter(p.filter) : getRekapRaw();
    return `📊 REKAP\n━━━━━━━━━━━━\nPemasukan  : ${fmt(r.income)}\nPengeluaran: ${fmt(Math.abs(r.expense))}\n━━━━━━━━━━━━\nNET        : ${fmt(r.net)}`;
  }

  if (p.type === "history") {
    const rows = getHistory(p.filter);
    if (!rows.length) return "📭 Tidak ada data";
    return rows.slice(0, 10).map(r => `${r.ts} | ${r.account.toUpperCase()} | ${fmt(r.amount)} | ${r.note}`).join("\n");
  }

  if (p.type === "edit") {
    const last = getLastTx(p.account);
    if (!last) return "⚠️ Tidak ada transaksi";
    addCorrection(last, p.newAmount);
    return "✏️ Transaksi dikoreksi";
  }

  if (p.type === "tx") {
    addTx(p);
    const saldo = getSaldo(p.account, true);
    return `✅ TRANSAKSI\n━━━━━━━━━━━━\nUser     : ${p.user}\nAkun     : ${p.account.toUpperCase()}\nKategori : ${p.category}\nJumlah   : ${fmt(Math.abs(p.amount))}\n━━━━━━━━━━━━\nSaldo ${p.account.toUpperCase()}\n${fmt(saldo)}`;
  }

  if (p.type === "export") return exportText();
  return "⚠️ Perintah tidak dikenali";
}

pollUpdates(handleMessage);
console.log("MY FINANCE BOT v2 RUNNING");

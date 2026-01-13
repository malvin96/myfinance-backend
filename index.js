import express from "express";
import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getHistory } from "./db.js";
import { appendToSheet } from "./sheets.js";
import { getRekapRaw, getRekapByFilter } from "./aggregate.js";

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot Finance Malvin & Yovita Aktif!"));
app.listen(PORT, () => console.log(`Server aktif di port ${PORT}`));

initDB();
const fmt = n => `Rp ${Number(n).toLocaleString("id-ID")}`;

async function handleMessage(msg) {
  const text = msg.text.trim();
  const senderId = msg.from.id;
  
  // Keamanan Akses
  const authorizedIds = [5023700044, 8469259152];
  if (!authorizedIds.includes(senderId)) return "⚠️ Akses Ditolak.";

  const p = parseInput(text, senderId);

  if (p.type === "tx") {
    addTx(p);
    await appendToSheet(p); // Backup ke Google Sheets
    const s = getSaldo(p.account, true);
    return `✅ TERCATAT (${p.user})\n━━━━━━━━━━━━\n${p.category}: ${fmt(Math.abs(p.amount))}\nAkun: ${p.account.toUpperCase()}\nKet: ${p.note}\n━━━━━━━━━━━━\nSaldo ${p.account.toUpperCase()}: ${fmt(s)}`;
  }

  if (p.type === "saldo") {
    const s = getSaldo(p.account, true);
    return `💰 SALDO ${p.account.toUpperCase()}\n━━━━━━━━━━━━\n${fmt(s)}`;
  }

  if (p.type === "rekap") {
    const r = p.filter.includes(" ") ? getRekapByFilter(p.filter) : getRekapRaw();
    return `📊 REKAP\n━━━━━━━━━━━━\nMasuk: ${fmt(r.income)}\nKeluar: ${fmt(Math.abs(r.expense))}\n━━━━━━━━━━━━\nNET: ${fmt(r.net)}`;
  }

  if (p.type === "history") {
    const rows = getHistory();
    if (!rows.length) return "📭 Belum ada data.";
    return `📜 5 TRANSAKSI TERAKHIR\n` + 
      rows.slice(0, 5).map(r => `${r.ts.split(' ')[0]} | ${r.user} | ${fmt(r.amount)} | ${r.note}`).join("\n");
  }

  return "⚠️ Perintah tidak dikenali.";
}

pollUpdates(handleMessage);

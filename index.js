// index.js
import express from "express";
import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getHistory, getLastTx, addCorrection } from "./db.js";
import { getRekapRaw, getRekapByFilter } from "./aggregate.js";
import { setBudget, getBudgetStatus } from "./budget.js"; // Pastikan diimport

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot Finance Malvin & Yovita Aktif!"));
app.listen(PORT, () => console.log(`Server aktif di port ${PORT}`));

initDB();
const fmt = n => `Rp ${Number(n).toLocaleString("id-ID")}`;

async function handleMessage(msg) {
  const text = msg.text.trim();
  const senderId = msg.from.id;
  const authorizedIds = [5023700044, 8469259152];
  if (!authorizedIds.includes(senderId)) return "⚠️ Akses Ditolak.";

  const p = parseInput(text, senderId);

  // Fitur Transaksi
  if (p.type === "tx") {
    addTx(p);
    const s = getSaldo(p.account, true);
    return `✅ TERCATAT (${p.user})\n━━━━━━━━━━━━\n${p.category}: ${fmt(Math.abs(p.amount))}\nAkun: ${p.account.toUpperCase()}\nKet: ${p.note}\n━━━━━━━━━━━━\nSaldo ${p.account.toUpperCase()}: ${fmt(s)}`;
  }

  // Fitur Saldo & Rekap
  if (p.type === "saldo") return `💰 SALDO ${p.account.toUpperCase()}\n━━━━━━━━━━━━\n${fmt(getSaldo(p.account, true))}`;
  
  if (p.type === "rekap") {
    const r = getRekapRaw();
    return `📊 REKAP\n━━━━━━━━━━━━\nMasuk: ${fmt(r.income)}\nKeluar: ${fmt(Math.abs(r.expense))}\n━━━━━━━━━━━━\nNET: ${fmt(r.net)}`;
  }

  // Fitur Budget (Aktifkan)
  if (text.startsWith("set budget ")) {
    const parts = text.split(" ");
    if(parts.length >= 4) {
      setBudget(parts[2], parseInt(parts[3]));
      return `🎯 Budget ${parts[2]} diset ke ${fmt(parts[3])}`;
    }
  }
  if (text === "cek budget") return getBudgetStatus(fmt);

  // Fitur History
  if (p.type === "history") {
    const rows = getHistory();
    return `📜 5 TRANSAKSI TERAKHIR\n` + rows.slice(0, 5).map(r => `${r.ts.split(' ')[0]} | ${r.user} | ${fmt(r.amount)} | ${r.note}`).join("\n");
  }

  // Fitur Koreksi
  if (p.type === "edit") {
    const last = getLastTx(p.account);
    if (!last) return "⚠️ Tidak ada data.";
    addCorrection(last, p.newAmount);
    return `✏️ KOREKSI BERHASIL: Saldo ${p.account} disesuaikan ke ${fmt(p.newAmount)}`;
  }

  return "⚠️ Perintah tidak dikenali.";
}

pollUpdates(handleMessage);

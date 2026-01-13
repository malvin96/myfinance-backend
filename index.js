import express from "express";
import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getHistory, getLastTx, addCorrection } from "./db.js";
import { getRekapRaw, getRekapByFilter } from "./aggregate.js";

// Server untuk Render agar tidak kena suspend
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot Finance Malvin & Yovita Aktif!"));
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

initDB();
const fmt = n => `Rp ${Number(n).toLocaleString("id-ID")}`;

async function handleMessage(msg) {
  const text = msg.text.trim();
  const senderId = msg.from.id;

  // Proteksi Keamanan
  const authorizedIds = [5023700044, 8469259152];
  if (!authorizedIds.includes(senderId)) return "⚠️ Akses Ditolak.";

  const p = parseInput(text, senderId);

  // Fitur Transaksi
  if (p.type === "tx") {
    addTx(p);
    const s = getSaldo(p.account, true);
    return `✅ TERCATAT (${p.user})\n━━━━━━━━━━━━\n${p.category}: ${fmt(Math.abs(p.amount))}\nAkun: ${p.account.toUpperCase()}\nKet: ${p.note}\n━━━━━━━━━━━━\nSaldo ${p.account.toUpperCase()}: ${fmt(s)}`;
  }

  // Fitur Saldo
  if (p.type === "saldo") {
    const s = getSaldo(p.account, true);
    return `💰 SALDO ${p.account.toUpperCase()}\n━━━━━━━━━━━━\n${fmt(s)}`;
  }

  // Fitur Rekap
  if (p.type === "rekap") {
    const r = p.filter.includes(" ") ? getRekapByFilter(p.filter) : getRekapRaw();
    return `📊 REKAP\n━━━━━━━━━━━━\nMasuk: ${fmt(r.income)}\nKeluar: ${fmt(Math.abs(r.expense))}\n━━━━━━━━━━━━\nNET: ${fmt(r.net)}`;
  }

  // Fitur History
  if (p.type === "history") {
    const rows = getHistory();
    if (!rows.length) return "📭 Belum ada data.";
    return `📜 5 TRANSAKSI TERAKHIR\n━━━━━━━━━━━━\n` + 
      rows.slice(0, 5).map(r => `${r.ts.split(' ')[0]} | ${r.user} | ${fmt(r.amount)} | ${r.note}`).join("\n");
  }

  // Fitur Edit/Koreksi (Contoh: "edit bca 50k")
  if (p.type === "edit") {
    const last = getLastTx(p.account);
    if (!last) return "⚠️ Tidak ditemukan transaksi terakhir di akun ini.";
    addCorrection(last, p.newAmount);
    return `✏️ KOREKSI BERHASIL\nTransaksi terakhir di ${p.account} telah disesuaikan menjadi ${fmt(p.newAmount)}.`;
  }

  return "⚠️ Perintah tidak dipahami. Contoh: '50k makan' atau 'saldo bca'";
}

pollUpdates(handleMessage);
console.log("MY FINANCE BOT v2.5 RUNNING");

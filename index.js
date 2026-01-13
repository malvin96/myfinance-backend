import express from "express";
import { pollUpdates } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getHistory, getLastTx, addCorrection } from "./db.js";
import { getRekapRaw, getRekapByFilter } from "./aggregate.js";

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot Finance Running..."));
app.listen(PORT, () => console.log(`Server aktif di port ${PORT}`));

initDB();

async function handleMessage(msg) {
  const text = msg.text.trim();
  const username = msg.from.username; // Otomatis ambil username pengirim
  
  // KEAMANAN: Masukkan username Anda dan Istri agar orang lain tidak bisa akses
  const authorizedUsers = ["MalvinHen", "UsernameIstriAnda"]; 
  if (!authorizedUsers.includes(username)) {
    return "⚠️ Akses ditolak. Anda tidak terdaftar dalam sistem.";
  }

  const p = parseInput(text, username);
  const fmt = n => `Rp ${Number(n).toLocaleString("id-ID")}`;

  if (p.type === "tx") {
    addTx(p);
    const saldo = getSaldo(p.account, true);
    return `✅ BERHASIL (${p.user})\n━━━━━━━━━━━━\n${p.category}: ${fmt(Math.abs(p.amount))}\nKet: ${p.note}\n━━━━━━━━━━━━\nSaldo ${p.account.toUpperCase()}: ${fmt(saldo)}`;
  }

  if (p.type === "saldo") {
    const s = getSaldo(p.account, true);
    return `💰 SALDO ${p.account.toUpperCase()}\n━━━━━━━━━━━━\n${fmt(s)}`;
  }

  if (p.type === "rekap") {
    const r = getRekapRaw();
    return `📊 REKAP\n━━━━━━━━━━━━\nMasuk: ${fmt(r.income)}\nKeluar: ${fmt(Math.abs(r.expense))}\nNet: ${fmt(r.net)}`;
  }

  if (p.type === "export") {
    // Logika export teks sederhana
    const history = getHistory();
    return history.slice(0, 20).map(r => `${r.ts} | ${r.user} | ${fmt(r.amount)} | ${r.note}`).join("\n");
  }

  return "⚠️ Perintah tidak dikenali.";
}

pollUpdates(handleMessage);

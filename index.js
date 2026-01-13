import express from "express";
import { pollUpdates, sendMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, addReminder, getReminders, deleteLastTx } from "./db.js";

const app = express();
app.get("/", (req, res) => res.send("Bot Aktif"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp. " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━";

// AUTO-REMINDER CC 21:00
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 21 && now.getMinutes() === 0) {
    const cc = getTotalCCHariIni();
    if (cc && cc.total < 0) {
      const msg = `🔔 *REMINDER CC*\n${line}\nTotal CC hari ini: *${fmt(Math.abs(cc.total))}*\nJangan lupa dilunasi! 💳`;
      sendMessage(5023700044, msg); 
    }
  }
}, 60000);

async function handleMessage(msg) {
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;

  const results = parseInput(msg.text, senderId);
  if (!results.length) return;

  if (results.length === 1) {
    const p = results[0];
    if (p.type === "rekap") {
      const d = getRekapLengkap();
      const cc = getTotalCCHariIni();
      let out = `📊 *REKAP SALDO*\n${line}\n`;
      d.perAccount.forEach(a => {
        if (a.account !== 'cc') out += `💰 ${a.account.toUpperCase().padEnd(12)} : \`${fmt(a.balance)}\`\n`;
      });
      out += `\n💳 *CC HARI INI*:\n└ \`${fmt(Math.abs(cc.total || 0))}\` (Reminder)\n`;
      out += `${line}\n💰 *NET REAL*: *${fmt(d.total.net_real || 0)}*`;
      return out;
    }
    if (p.type === "koreksi") {
      const deleted = deleteLastTx(p.user);
      return deleted ? `🗑️ *KOREKSI BERHASIL*\nTransaksi terakhir dihapus:\n"${deleted.note}" (${fmt(Math.abs(deleted.amount))})` : "❌ Tidak ada transaksi untuk dikoreksi.";
    }
    if (p.type === "list_reminder") {
      const rems = getReminders();
      return rems.length ? `📅 *TAGIHAN*\n${line}\n` + rems.map(r => `• Tgl ${r.due_date}: ${r.note}`).join('\n') : "Kosong.";
    }
  }

  let replies = [];
  for (let p of results) {
    if (p.type === "add_reminder") {
      addReminder(p.note, p.dueDate);
      replies.push(`🔔 Reminder: *${p.note}* tgl ${p.dueDate}`);
    } else if (p.type === "tx") {
      addTx(p);
      replies.push(`✅ Tersimpan: *${p.category}* (${fmt(Math.abs(p.amount))})`);
    } else if (p.type === "transfer_akun") {
      addTx({ ...p, account: p.from, amount: -p.amount, category: "Transfer" });
      addTx({ ...p, account: p.to, amount: p.amount, category: "Transfer" });
      replies.push(`🔄 Pindah dana: ${fmt(p.amount)} dari ${p.from.toUpperCase()}`);
    } else if (p.type === "set_saldo") {
      addTx({ ...p, category: "Saldo Awal" });
      replies.push(`💰 Saldo ${p.account.toUpperCase()} diset: \`${fmt(p.amount)}\``);
    }
  }
  return replies.join('\n');
}

pollUpdates(handleMessage);

import express from "express";
import { pollUpdates, sendMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, addReminder, getReminders } from "./db.js";

const app = express();
app.get("/", (req, res) => res.send("Bot Aktif"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp. " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━";

// AUTO-REMINDER: Cek transaksi CC setiap jam 21:00
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 21 && now.getMinutes() === 0) {
    const cc = getTotalCCHariIni();
    if (cc && cc.total < 0) {
      const totalHutang = Math.abs(cc.total);
      const msg = `🔔 *REMINDER PELUNASAN CC*\n${line}\nMalvin, total transaksi CC kamu hari ini: *${fmt(totalHutang)}*.\n\nJangan lupa dilunasi malam ini ya agar poin aman! 💳`;
      sendMessage(5023700044, msg);
    }
  }
}, 60000);

async function handleMessage(msg) {
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;

  const results = parseInput(msg.text, senderId);
  if (!results.length) return;

  if (results.length === 1 && (results[0].type === "rekap")) {
      const d = getRekapLengkap();
      const cc = getTotalCCHariIni();
      let out = `📊 *REKAP SALDO*\n${line}\n`;
      
      d.perAccount.forEach(a => {
        if (a.account !== 'cc') {
          out += `💰 ${a.account.toUpperCase().padEnd(8)} : \`${fmt(a.balance)}\`\n`;
        }
      });

      out += `\n💳 *TRANSAKSI CC HARI INI*:\n└ \`${fmt(Math.abs(cc.total || 0))}\` (Belum Lunas)\n`;
      out += `${line}\n💰 *NET REAL*: *${fmt(d.total.net_real || 0)}*`;
      return out;
  }

  let replies = [];
  for (let p of results) {
    if (p.type === "add_reminder") {
      addReminder(p.note, p.dueDate);
      replies.push(`🔔 Reminder dicatat: *${p.note}* setiap tanggal ${p.dueDate}`);
    } else if (p.type === "tx") {
      addTx(p);
      replies.push(`✅ Tersimpan: *${p.category}* (${fmt(Math.abs(p.amount))})`);
    } else if (p.type === "transfer_akun") {
      addTx({ ...p, account: p.from, amount: -p.amount, category: "Pelunasan CC" });
      addTx({ ...p, account: p.to, amount: p.amount, category: "Pelunasan CC" });
      replies.push(`🔄 *LUNAS!* Saldo ${p.from.toUpperCase()} dipindah ke CC sebesar ${fmt(p.amount)}`);
    } else if (p.type === "set_saldo") {
      addTx({ ...p, category: "Saldo Awal" });
      replies.push(`💰 Saldo ${p.account.toUpperCase()} diset: \`${fmt(p.amount)}\``);
    }
  }
  return replies.join('\n');
}

pollUpdates(handleMessage);

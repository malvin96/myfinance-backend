import express from "express";
import { pollUpdates, sendMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, addReminder, getReminders, deleteLastTx, resetAccountBalance } from "./db.js";
import { appendToSheet } from "./sheets.js";

const app = express();
app.get("/", (req, res) => res.send("Bot Aktif"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━";

// Reminder CC Jam 21:00
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 21 && now.getMinutes() === 0) {
    const cc = getTotalCCHariIni();
    if (cc && cc.total < 0) {
      const msg = `🔔 *REMINDER PELUNASAN CC*\n${line}\nTotal CC hari ini: *${fmt(Math.abs(cc.total))}*\nJangan lupa dilunasi malam ini! 💳`;
      sendMessage(5023700044, msg); 
    }
  }
}, 60000);

async function handleMessage(msg) {
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;

  const results = parseInput(msg.text, senderId);
  if (!results.length) return;

  // Laporan Rekap dengan UI Baru
  if (results.length === 1 && results[0].type === "rekap") {
    const d = getRekapLengkap();
    const cc = getTotalCCHariIni();
    let out = `📊 *REKAP KEUANGAN KELUARGA*\n${line}\n`;
    
    const users = [...new Set(d.rows.map(r => r.user))];
    users.forEach(u => {
      const userName = u === 'M' ? '🧔 MALVIN' : '👩 YOVITA';
      out += `\n*${userName}*\n`;
      const userAccounts = d.rows.filter(r => r.user === u);
      let userTotal = 0;
      userAccounts.forEach(a => {
        if(a.account !== 'cc') {
          out += ` ├ ${a.account.toUpperCase().padEnd(12)}: \`${fmt(a.balance)}\`\n`;
          userTotal += a.balance;
        }
      });
      out += ` └ *Subtotal:* \`${fmt(userTotal)}\`\n`;
    });

    out += `\n💳 *TRANSAKSI CC (HARI INI)*\n └ Belum Lunas: \`${fmt(Math.abs(cc.total || 0))}\`\n`;
    out += `\n${line}\n💰 *TOTAL KEKAYAAN GABUNGAN*\n👉 *${fmt(d.totalWealth)}*`;
    return out;
  }

  let replies = [];
  for (let p of results) {
    try {
      if (p.type === "koreksi") {
        const del = deleteLastTx(p.user);
        replies.push(del ? `🗑️ *KOREKSI BERHASIL*\nDihapus: "${del.note}" (${fmt(Math.abs(del.amount))})` : "❌ Tidak ada transaksi.");
      } else if (p.type === "set_saldo") {
        // Reset dulu baru tambah (Overwrite)
        resetAccountBalance(p.user, p.account);
        addTx({ ...p, category: "Saldo Awal" });
        appendToSheet(p).catch(e => console.error("Sheet Error:", e.message));
        replies.push(`💰 Saldo ${p.account.toUpperCase()} diset: \`${fmt(p.amount)}\``);
      } else if (p.type === "tx") {
        addTx(p);
        appendToSheet(p).catch(e => console.error("Sheet Error:", e.message));
        const emoji = p.amount > 0 ? "📈" : "📉";
        replies.push(`${emoji} *${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`);
      } else if (p.type === "transfer_akun") {
        addTx({ ...p, account: p.from, amount: -p.amount, category: "Transfer" });
        addTx({ ...p, account: p.to, amount: p.amount, category: "Transfer" });
        appendToSheet(p).catch(e => console.error("Sheet Error:", e.message));
        replies.push(`🔄 *TRANSFER BERHASIL*\n└ \`${fmt(p.amount)}\` (${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()})`);
      } else if (p.type === "add_reminder") {
        addReminder(p.note, p.dueDate);
        replies.push(`🔔 Reminder disimpan: *${p.note}* tgl ${p.dueDate}`);
      }
    } catch (e) {
      console.error(e);
      replies.push("❌ Error saat memproses.");
    }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);

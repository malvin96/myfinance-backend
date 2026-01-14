import express from "express";
import { pollUpdates, sendMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, addReminder, getReminders, deleteLastTx } from "./db.js";
import { appendToSheet } from "./sheets.js";

const app = express();
app.get("/", (req, res) => res.send("Bot Aktif"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━";

// AUTO-REMINDER CC 21:00
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

  if (results.length === 1 && results[0].type === "rekap") {
    const d = getRekapLengkap();
    const cc = getTotalCCHariIni();
    
    let out = `📊 *REKAP KEUANGAN KELUARGA*\n${line}\n`;
    
    // Kelompokkan data berdasarkan User
    const users = [...new Set(d.rows.map(r => r.user))];
    users.forEach(u => {
      const userName = u === 'M' ? '🧔 MALVIN' : '👩 YOVITA';
      out += `\n*${userName}*\n`;
      const userAccounts = d.rows.filter(r => r.user === u);
      let userTotal = 0;
      userAccounts.forEach(a => {
        if(a.account !== 'cc') {
          out += ` ├ ${a.account.toUpperCase().padEnd(10)}: \`${fmt(a.balance)}\`\n`;
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
      } else if (p.type === "add_reminder") {
        addReminder(p.note, p.dueDate);
        replies.push(`🔔 Reminder: *${p.note}* tgl ${p.dueDate}`);
      } else if (p.type === "tx" || p.type === "set_saldo" || p.type === "transfer_akun") {
        // Eksekusi DB
        if (p.type === "tx" || p.type === "set_saldo") {
          addTx({ ...p, category: p.type === "set_saldo" ? "Saldo Awal" : p.category });
        } else {
          addTx({ ...p, account: p.from, amount: -p.amount, category: "Transfer" });
          addTx({ ...p, account: p.to, amount: p.amount, category: "Transfer" });
        }
        
        // KIRIM KE SHEET TANPA AWAIT (Latar Belakang)
        appendToSheet(p).catch(e => console.error("Sheet Error:", e.message));
        
        const emoji = p.amount > 0 ? "📈" : "📉";
        const label = p.type === "set_saldo" ? "SALDO AWAL" : (p.type === "transfer_akun" ? "TRANSFER" : p.category.toUpperCase());
        replies.push(`${emoji} *${label}*\n└ \`${fmt(Math.abs(p.amount || 0))}\` (${p.user} | ${p.account?.toUpperCase() || 'TRF'})`);
      }
    } catch (e) {
      console.error("Proses Error:", e);
      replies.push("❌ Terjadi kesalahan teknis.");
    }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);

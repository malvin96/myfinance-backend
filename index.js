import express from "express";
import { pollUpdates, sendMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, addReminder, deleteLastTx, resetAccountBalance, setBudget, getBudgetStatus, getChartData } from "./db.js";
import { appendToSheet } from "./sheets.js";

const app = express();
app.get("/", (req, res) => res.send("Bot Aktif"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━";

// Reminder CC Otomatis Jam 21:00
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

  if (results.length === 1 && results[0].type === "rekap") {
    const d = getRekapLengkap();
    const catData = getChartData();
    const cc = getTotalCCHariIni();
    
    let out = `📊 *REKAP KEUANGAN KELUARGA*\n${line}\n`;
    const users = [...new Set(d.rows.map(r => r.user))];
    users.forEach(u => {
      out += `\n*${u === 'M' ? '🧔 MALVIN' : '👩 YOVITA'}*\n`;
      let userTotal = 0;
      d.rows.filter(r => r.user === u).forEach(a => {
        if(a.account !== 'cc') {
          out += ` ├ ${a.account.toUpperCase().padEnd(10)}: \`${fmt(a.balance)}\`\n`;
          userTotal += a.balance;
        }
      });
      out += ` └ *Subtotal:* \`${fmt(userTotal)}\`\n`;
    });

    out += `\n💳 *CC HARI INI:* \`${fmt(Math.abs(cc.total || 0))}\`\n`;
    out += `${line}\n💰 *TOTAL KEKAYAAN:* *${fmt(d.totalWealth)}*\n`;

    if (catData.length > 0) {
      const labels = catData.map(i => i.category);
      const values = catData.map(i => i.total);
      const chartUrl = `https://quickchart.io/chart?c={type:'doughnut',data:{labels:[${labels.map(l=>`'${l}'`)}],datasets:[{data:[${values}]}]}}`;
      out += `\n📈 *ANALISA PENGELUARAN*\n└ [Klik Lihat Grafik](${chartUrl})`;
    }
    return out;
  }

  let replies = [];
  for (let p of results) {
    try {
      let emoji = p.amount > 0 ? "📈" : "📉";
      let header = (p.category || "TX").toUpperCase();

      if (p.type === "set_budget") {
        setBudget(p.category, p.amount);
        replies.push(`🎯 Budget *${p.category}* diset ke \`${fmt(p.amount)}\``);
        continue;
      } 
      
      if (p.type === "export_pdf") {
        replies.push("📄 Laporan sedang diproses...");
        continue;
      }

      if (p.type === "koreksi") {
        const del = deleteLastTx(p.user);
        replies.push(del ? `🗑️ *KOREKSI BERHASIL*\nDihapus: "${del.note}"` : "❌ Tidak ada transaksi.");
        continue;
      }

      // Logika Inti Transaksi & Saldo
      if (p.type === "set_saldo") {
        resetAccountBalance(p.user, p.account);
        addTx({ ...p, category: "Saldo Awal" });
        emoji = "💰";
        header = "SET SALDO";
      } else if (p.type === "transfer_akun") {
        addTx({ ...p, account: p.from, amount: -p.amount, category: "Transfer" });
        addTx({ ...p, account: p.to, amount: p.amount, category: "Transfer" });
        emoji = "🔄";
        header = "TRANSFER";
      } else {
        addTx(p);
      }
      
      // Kirim ke Google Sheets di background
      appendToSheet(p).catch(e => console.error("Sheets Error:", e));
      
      let msgReply = `${emoji} *${header}*\n└ \`${fmt(Math.abs(p.amount || 0))}\` (${p.user} | ${p.account.toUpperCase()})`;
      
      // Cek Budget
      const b = getBudgetStatus(p.category);
      if (b && p.type === "tx") {
        const persen = Math.round((b.spent / b.limit) * 100);
        msgReply += `\n\n⚠️ *STATUS BUDGET*\n└ Sisa: \`${fmt(b.limit - b.spent)}\` (${persen}%)`;
      }
      replies.push(msgReply);

    } catch (e) { 
      console.error(e);
      replies.push("❌ Terjadi kesalahan teknis."); 
    }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);

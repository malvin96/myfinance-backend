import express from "express";
import { pollUpdates, sendMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, deleteLastTx, resetAccountBalance, setBudget, getBudgetStatus, getChartData } from "./db.js";
import { appendToSheet } from "./sheets.js";

const app = express();
app.get("/", (req, res) => res.send("Bot Aktif"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━";

// Akun yang dikategorikan sebagai Liquid (Dana Siap Pakai)
const LIQUID_ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];

// Reminder CC Jam 21:00
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 21 && now.getMinutes() === 0) {
    const cc = getTotalCCHariIni();
    if (cc && cc.total < 0) {
      const msg = `🔔 *REMINDER CC*\n${line}\nTotal tagihan CC hari ini: *${fmt(Math.abs(cc.total))}*\nJangan lupa dilunasi malam ini! 💳`;
      sendMessage(5023700044, msg); 
    }
  }
}, 60000);

async function handleMessage(msg) {
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;

  const results = parseInput(msg.text, senderId);
  if (!results.length) return;

  // Laporan Rekap Liquid vs Aset
  if (results.length === 1 && results[0].type === "rekap") {
    const d = getRekapLengkap();
    const catData = getChartData();
    const cc = getTotalCCHariIni();
    
    let out = `📊 *LAPORAN KEUANGAN KELUARGA*\n${line}\n`;
    const users = [...new Set(d.rows.map(r => r.user))];

    users.forEach(u => {
      out += `\n*${u === 'M' ? '🧔 MALVIN' : '👩 YOVITA'}*\n`;
      
      const liquid = d.rows.filter(r => r.user === u && LIQUID_ACCOUNTS.includes(r.account));
      if (liquid.length > 0) {
        out += ` 💧 *Liquid (Dana Siap Pakai)*\n`;
        liquid.forEach(a => out += `  ├ ${a.account.toUpperCase().padEnd(10)}: \`${fmt(a.balance)}\`\n`);
      }

      const assets = d.rows.filter(r => r.user === u && !LIQUID_ACCOUNTS.includes(r.account) && r.account !== 'cc');
      if (assets.length > 0) {
        out += ` 💰 *Assets (Investasi/Tabungan)*\n`;
        assets.forEach(a => out += `  ├ ${a.account.toUpperCase().padEnd(10)}: \`${fmt(a.balance)}\`\n`);
      }
      
      const userTotal = d.rows.filter(r => r.user === u && r.account !== 'cc').reduce((a, b) => a + b.balance, 0);
      out += ` └ *User Net Worth:* \`${fmt(userTotal)}\`\n`;
    });

    out += `\n💳 *CC HARI INI:* \`${fmt(Math.abs(cc.total || 0))}\`\n`;
    out += `${line}\n🌍 *NET WORTH GABUNGAN*\n👉 *${fmt(d.totalWealth)}*\n`;

    if (catData.length > 0) {
      const labels = catData.map(i => i.category);
      const values = catData.map(i => i.total);
      const chartUrl = `https://quickchart.io/chart?c={type:'doughnut',data:{labels:[${labels.map(l=>`'${l}'`)}],datasets:[{data:[${values}]}]}}`;
      out += `\n📈 *ANALISA PENGELUARAN*\n└ [Klik Lihat Grafik Donat](${chartUrl})`;
    }
    return out;
  }

  let replies = [];
  for (let p of results) {
    try {
      if (p.type === "set_budget") {
        setBudget(p.category, p.amount);
        replies.push(`🎯 Budget *${p.category}* diset ke \`${fmt(p.amount)}\``);
        continue;
      } 
      if (p.type === "koreksi") {
        const del = deleteLastTx(p.user);
        replies.push(del ? `🗑️ *KOREKSI BERHASIL*\nDihapus: "${del.note}"` : "❌ Tidak ada transaksi.");
        continue;
      }

      let msgReply = "";
      if (p.type === "set_saldo") {
        resetAccountBalance(p.user, p.account);
        addTx({ ...p, category: "Saldo Awal" });
        msgReply = `💰 *SET SALDO ${p.account.toUpperCase()} (${p.user}) - ${fmt(p.amount)}*`;
      } else if (p.type === "transfer_akun") {
        addTx({ ...p, account: p.from, amount: -p.amount, category: "Transfer" });
        addTx({ ...p, account: p.to, amount: p.amount, category: "Transfer" });
        msgReply = `🔄 *TRANSFER ${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()} (${p.user}) - ${fmt(p.amount)}*`;
      } else {
        addTx(p);
        const emoji = p.amount > 0 ? "📈" : "📉";
        msgReply = `${emoji} *${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`;
        
        const b = getBudgetStatus(p.category);
        if (b && p.amount < 0) {
          const persen = Math.round((b.spent / b.limit) * 100);
          msgReply += `\n\n⚠️ *STATUS BUDGET*\n└ Sisa: \`${fmt(b.limit - b.spent)}\` (${persen}%)`;
        }
      }
      appendToSheet(p).catch(e => console.error(e));
      replies.push(msgReply);
    } catch (e) { replies.push("❌ Terjadi kesalahan teknis."); }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);

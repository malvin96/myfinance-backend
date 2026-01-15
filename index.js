import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, getFileLink } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, resetAccountBalance, getBudgetSummary, getCashflowSummary, deleteLastTx, getFilteredTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet } from "./sheets.js";
import { CATEGORIES } from "./categories.js";
import fetch from "node-fetch";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo v4.9 Final Fixed"));
const port = process.env.PORT || 3000;
app.listen(port);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

// [KUNCI] Definisi Akun Sesuai Request
const LIQUID = ["cash", "bca", "ovo", "gopay", "shopeepay"];
const ASSETS = ["bibit", "mirrae", "bca sekuritas"];

const pendingTxs = {};

// AUTO BACKUP (23:59 WIB)
cron.schedule('59 23 * * *', async () => {
  const date = new Date().toISOString().slice(0, 10);
  const file = `myfinance_backup_${date}.db`;
  try {
    if (fs.existsSync('myfinance.db')) {
      fs.copyFileSync('myfinance.db', file);
      await sendDocument(5023700044, file, `📂 **DAILY BACKUP**\n${line}\n📅: \`${date}\`\n✅ Simpan file ini untuk RESTORE jika Render reset.`);
      fs.unlinkSync(file);
    }
  } catch (e) { console.error(e); }
}, { timezone: "Asia/Jakarta" });

// REMINDER CC (21:00 WIB)
cron.schedule('0 21 * * *', async () => {
  const cc = getTotalCCHariIni();
  if (cc && cc.total < 0) sendMessage(5023700044, `🔔 *REMINDER CC*\n${line}\nTagihan CC hari ini: *${fmt(Math.abs(cc.total))}*\nJangan lupa dilunasi! 💳`); 
}, { timezone: "Asia/Jakarta" });

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (![5023700044, 8469259152].includes(senderId)) return;
  
  // RESTORE LOGIC
  if (msg.document && (msg.document.file_name.endsWith('.db') || msg.document.file_name.endsWith('.sqlite'))) {
    sendMessage(chatId, "⏳ **MENDETEKSI DATABASE...**\nSedang memulihkan data...");
    const link = await getFileLink(msg.document.file_id);
    if (link) {
      try {
        const res = await fetch(link);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync("myfinance.db", Buffer.from(buffer));
        setTimeout(() => { process.exit(0); }, 2000); 
        return "✅ **RESTORE SUKSES!**\nData telah pulih. Bot akan restart sebentar...";
      } catch (e) { console.error(e); return "❌ Gagal restore."; }
    }
  }

  const text = msg.text ? msg.text.trim().toLowerCase() : "";
  if (!text) return;

  if (pendingTxs[chatId]) {
    const matched = CATEGORIES.find(c => c.cat.toLowerCase() === text);
    if (matched) {
      const p = pendingTxs[chatId]; p.category = matched.cat;
      if (p.category === "Pendapatan") p.amount = Math.abs(p.amount);
      delete pendingTxs[chatId]; addTx(p); appendToSheet(p).catch(console.error);
      return `✅ *TERCATAT DI ${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`;
    } else if (text === "batal") { delete pendingTxs[chatId]; return "❌ Dibatalkan."; }
    else { return `⚠️ Pilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}`; }
  }

  const results = parseInput(msg.text, senderId);
  
  // ANTI-DIAM (ERROR HANDLING)
  if (!results.length) {
      return `⚠️ **SAYA TIDAK MENGERTI**\n\nFormat yang benar:\n\`[Angka] [Ket] [Akun]\`\n\nContoh:\n• \`50k makan bca\`\n• \`20rb bensin cash\`\n\nAtau ketik \`list\` untuk bantuan.`;
  }

  let replies = [];
  for (let p of results) {
    try {
      if (p.type === "list") {
        let out = `🤖 **MENU BANTUAN**\n${line}\n`;
        out += `📝 **INPUT TRANSAKSI**\nFormat: \`[Angka] [Ket] [Akun]\`\n• \`50k makan bca\` (Auto: QRIS/MBCA)\n• \`gaji 15jt bca\`\n• \`50k-15k cash\` (Hitung)\n• \`pindah 500k bca gopay\`\n\n`;
        out += `📂 **KATA KUNCI (KEYWORD)**\n• **Makan:** \`makan\`, \`jajan\`, \`kopi\`\n• **Transport:** \`bensin\`, \`parkir\`, \`grab\`\n• **Belanja:** \`shopee\`, \`beli\`, \`baju\`\n• **Tagihan:** \`listrik\`, \`pulsa\`, \`cc\`\n• **Investasi:** \`bibit\`, \`crypto\`, \`saham\`\n\n`;
        out += `📊 **LAPORAN & DATA**\n• \`rekap\` (Cek Saldo)\n• \`history\` (10 Tx Terakhir)\n• \`export pdf\` (Bulan Ini)\n• \`export pdf minggu\` (7 Hari)\n\n`;
        out += `🛠️ **SYSTEM**\n• \`koreksi\` (Undo & Sync)\n• \`backup\` (Download DB)`;
        replies.push(out);
      } 
      else if (p.type === "rekap") {
        const d = getRekapLengkap();
        const cf = getCashflowSummary();
        const budgets = getBudgetSummary();
        const cc = getTotalCCHariIni();
        let out = `📊 *LAPORAN KEUANGAN*\n${line}\n`;
        [...new Set(d.rows.map(r => r.user))].forEach(u => {
          out += `\n*${u === 'M' ? '🧔 MALVIN' : '👩 YOVITA'}*\n`;
          
          // SECTION 1: LIQUID
          const liq = d.rows.filter(r => r.user === u && LIQUID.includes(r.account));
          if (liq.length > 0) {
            out += ` 💧 *Liquid*\n`;
            liq.forEach(a => out += `  ├ \`${a.account.toUpperCase().padEnd(10)}\`: \`${fmt(a.balance).padStart(14)}\`\n`);
          }

          // SECTION 2: ASSETS
          const ast = d.rows.filter(r => r.user === u && ASSETS.includes(r.account));
          if (ast.length > 0) {
            out += ` 💼 *Aset*\n`;
            ast.forEach(a => out += `  ├ \`${a.account.toUpperCase().padEnd(10)}\`: \`${fmt(a.balance).padStart(14)}\`\n`);
          }

          const total = d.rows.filter(r => r.user === u && r.account !== 'cc').reduce((a, b) => a + b.balance, 0);
          out += ` └ *Total Net:* \`${fmt(total).padStart(14)}\`\n`;
        });
        out += `\n📈 *CASHFLOW BULAN INI*\n 📥 *In  :*\`${fmt(cf.income).padStart(14)}\`\n 📤 *Out :*\`${fmt(cf.expense).padStart(14)}\`\n 💰 *Net :*\`${fmt(cf.income - cf.expense).padStart(14)}\`\n`;
        if (budgets.length > 0) {
          out += `\n🎯 *BUDGET SISA*\n`;
          budgets.forEach(b => out += ` ${b.spent > b.limit ? '🔴' : '🟢'} *${b.category}*: \`${fmt(b.limit - b.spent)}\`\n`);
        }
        out += `\n💳 *CC HARI INI:* \`${fmt(Math.abs(cc.total || 0))}\`\n${line}\n🌍 *NET WORTH:* **${fmt(d.totalWealth)}**\n`;
        replies.push(out);
      } 
      else if (p.type === "history") {
         const filter = { type: 'current', val: null }; 
         const allTxs = getFilteredTransactions(filter); 
         const txs = allTxs.slice(0, p.limit); 
         if (txs.length === 0) replies.push("📭 Belum ada transaksi bulan ini.");
         else {
            let out = `🗓️ *HISTORY ${txs.length} TERAKHIR*\n${line}\n`;
            txs.forEach(t => {
               const icon = t.amount > 0 ? "📈" : "📉";
               const shortNote = t.note.length > 15 ? t.note.substring(0, 15) + "..." : t.note;
               out += `${icon} \`${shortNote.padEnd(15)}\` : ${fmt(Math.abs(t.amount))}\n`;
            });
            replies.push(out);
         }
      }
      else if (p.type === "export_pdf") {
        const data = getFilteredTransactions(p.filter);
        if (!data || data.length === 0) replies.push(`❌ Tidak ada data: ${p.filter.title}`);
        else {
           const filePath = await createPDF(data, p.filter.title);
           await sendDocument(chatId, filePath, `📄 ${p.filter.title}`);
           fs.unlinkSync(filePath);
        }
      } 
      else if (p.type === "backup") {
        const file = `myfinance_manual.db`;
        fs.copyFileSync('myfinance.db', file);
        await sendDocument(chatId, file, `✅ **BACKUP MANUAL SELESAI**`);
        fs.unlinkSync(file);
      } 
      else if (p.type === "set_saldo") {
        resetAccountBalance(p.user, p.account);
        // [SYNC ENABLED] Kirim ke Sheet sebagai 'Saldo Awal'
        const tx = { ...p, category: "Saldo Awal" };
        addTx(tx);
        appendToSheet(tx).catch(console.error);
        replies.push(`💰 **SET SALDO ${p.account.toUpperCase()} - ${fmt(p.amount)}**`);
      } 
      else if (p.type === "transfer_akun") {
        // [SYNC ENABLED] Kirim 2 Transaksi ke Sheet (Out & In)
        const txOut = { ...p, account: p.from, amount: -p.amount, category: "Transfer" };
        const txIn = { ...p, account: p.to, amount: p.amount, category: "Transfer" };
        
        addTx(txOut);
        addTx(txIn);
        
        // Log ke Sheet
        appendToSheet(txOut).catch(console.error);
        appendToSheet(txIn).catch(console.error);

        replies.push(`🔄 *TRANSFER SUKSES*\n${p.from.toUpperCase()} ➔ ${p.to.toUpperCase()}: ${fmt(p.amount)}`);
      } 
      else if (p.type === "koreksi") {
        const lastTx = deleteLastTx(p.user);
        if (lastTx) {
          const reverseTx = {
            ...lastTx,
            amount: -lastTx.amount, 
            note: `[AUTO CORRECTION] Mengoreksi: ${lastTx.note} (${fmt(Math.abs(lastTx.amount))})`
          };
          appendToSheet(reverseTx).catch(console.error);
          replies.push(`✅ **TRANSAKSI DIHAPUS**\n"${lastTx.note}" sebesar ${fmt(Math.abs(lastTx.amount))} telah dibatalkan.\n\n_(Sheet telah disinkronkan otomatis)_`);
        } else {
          replies.push("❌ Tidak ada transaksi untuk dikoreksi.");
        }
      }
      else if (p.type === "tx") {
        if (p.category === "Lainnya") {
          pendingTxs[chatId] = p;
          replies.push(`❓ *KATEGORI TIDAK DIKENAL*\nUntuk: "${p.note}"\n\nPilih kategori:\n${CATEGORIES.map(c => `• \`${c.cat.toLowerCase()}\``).join('\n')}`);
        } else {
          addTx(p);
          replies.push(`${p.amount > 0 ? "📈" : "📉"} *${p.category.toUpperCase()}*\n└ \`${fmt(Math.abs(p.amount))}\` (${p.user} | ${p.account.toUpperCase()})`);
          appendToSheet(p).catch(console.error);
        }
      }
    } catch (e) { replies.push("❌ Error."); console.error(e); }
  }
  return replies.join('\n\n');
}

pollUpdates(handleMessage);

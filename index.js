import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet, overwriteSheet } from "./sheets.js";
import { CATEGORIES } from "./categories.js";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo Active"));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

const pendingTxs = {};      
const pendingAdmin = {};    

const LIQUID_LIST = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay'];
const ASSET_LIST = ['bibit', 'mirrae', 'bca sekuritas'];

// Helper Sisa Saldo
const getSisaSaldo = (user, account) => {
  const rekap = getRekapLengkap();
  const row = rekap.rows.find(r => r.user === user && r.account.toLowerCase() === account.toLowerCase());
  return row ? row.balance : 0;
};

cron.schedule('58 */14 * * * *', async () => {
  const adminId = process.env.TELEGRAM_USER_ID; 
  if (adminId && fs.existsSync('myfinance.db')) {
     const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
     await sendDocument(adminId, 'myfinance.db', `📦 Auto-Backup DB\n⏰ ${now}`, true);
  }
});

const handleMessage = async (msg) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const text = msg.text ? msg.text.trim() : "";
  const lowText = text.toLowerCase();

  const isMalvin = fromId === parseInt(process.env.TELEGRAM_USER_ID);
  const isYovita = fromId === parseInt(process.env.USER_ID_PARTNER);
  const isGroup = chatId === -5047317862;

  if (!isMalvin && !isYovita && !isGroup) return;
  const userCode = isMalvin ? 'M' : 'Y';
  const userLabel = isMalvin ? "MALVIN" : "YOVITA";

  // --- COMMANDS ---
  if (lowText === 'menu' || lowText === 'help' || lowText === '/start') {
    return "🏠 **MENU BOT**\n" + line + "\n" +
           "• Ketik langsung: `makan 50k`\n" +
           "• `Saldo` : Cek posisi keuangan\n" +
           "• `History 20` : Cek transaksi terakhir\n" +
           "• `Laporan` : Download Rekap PDF\n" +
           "• `Sync pull` : Download data Sheet\n" +
           "• `Sync push` : Upload data ke Sheet\n" +
           "• `Koreksi` : Hapus data terakhir";
  }

  if (lowText.startsWith('history')) {
    const limit = parseInt(lowText.replace('history', '').trim()) || 10;
    const data = getLatestTransactions(limit);
    let res = `📜 **HISTORY TRANSAKSI**\n${line}\n`;
    data.forEach(r => {
      const t = new Date(r.timestamp).toLocaleDateString('id-ID', {day:'2-digit', month:'2-digit'});
      const u = r.user === 'M' ? 'M' : 'Y';
      res += `${t} [${u}] ${r.account.toUpperCase()} | ${fmt(r.amount)}\n   └ ${r.note}\n`;
    });
    res += `${line}\n*Menampilkan ${data.length} data terakhir.*`;
    return res;
  }

  if (lowText === 'sync pull') {
    await sendMessage(chatId, "☁️ Mengunduh data Sheet...");
    const data = await downloadFromSheet();
    if (data.length > 0) {
      const count = rebuildDatabase(data);
      return `✅ Berhasil Pull ${count} data dari Sheet ke Database Lokal.`;
    }
    return "❌ Gagal mengunduh data.";
  }

  if (lowText === 'sync push') {
    const allData = getAllTransactions();
    await sendMessage(chatId, `🔄 Sedang Push ${allData.length} data...`);
    await overwriteSheet(allData);
    return `✅ Berhasil Push ${allData.length} data ke Google Sheets.`;
  }

  if (lowText === 'saldo' || lowText === 'cek saldo') {
    const rekap = getRekapLengkap();
    const buildSaldoUI = (code, label) => {
      const rows = rekap.rows.filter(r => r.user === code);
      if (rows.length === 0) return `Belum ada saldo untuk ${label}\n`;
      let s = `💰 **POSISI SALDO (${label})**\n${line}\n`;
      const liquids = rows.filter(r => LIQUID_LIST.includes(r.account.toLowerCase()));
      if (liquids.length > 0) {
        s += `*--- LIQUID ---*\n`;
        liquids.forEach(r => s += `🔹 ${r.account.toUpperCase().padEnd(9)}: ${fmt(r.balance)}\n`);
      }
      const assets = rows.filter(r => ASSET_LIST.includes(r.account.toLowerCase()));
      if (assets.length > 0) {
        s += `\n*--- ASET ---*\n`;
        assets.forEach(r => s += `🔸 ${r.account.toUpperCase().padEnd(9)}: ${fmt(r.balance)}\n`);
      }
      const cc = rows.filter(r => r.account.toLowerCase() === 'cc');
      if (cc.length > 0) {
        s += `\n*--- LAINNYA ---*\n`;
        cc.forEach(r => s += `🔻 ${r.account.toUpperCase().padEnd(9)}: ${fmt(r.balance)}\n`);
      }
      const total = rows.filter(r => r.account.toLowerCase() !== 'cc').reduce((a, b) => a + b.balance, 0);
      s += `${line}\n*Total Kekayaan: ${fmt(total)}*\n\n`;
      return s;
    };
    return buildSaldoUI('M', 'MALVIN') + buildSaldoUI('Y', 'YOVITA');
  }

  if (lowText === 'laporan') {
    await sendMessage(chatId, "📄 Membuat laporan PDF...");
    const data = getAllTransactions();
    const filePath = await createPDF(data, "LAPORAN KEUANGAN LENGKAP");
    await sendDocument(chatId, filePath, "Laporan lengkap (Rekap Saldo & All History Log).");
    return null;
  }

  // --- LOGIKA PENDING ---
  if (pendingAdmin[chatId] && !isNaN(text)) {
    const { txOut, txIn } = pendingAdmin[chatId];
    const fee = parseFloat(text);
    addTx(txOut); addTx(txIn);
    appendToSheet(txOut); appendToSheet(txIn);
    if (fee > 0) {
      const txFee = { ...txOut, amount: -fee, category: 'Tagihan', note: `Admin Transfer: ${txOut.note}` };
      addTx(txFee); appendToSheet(txFee);
    }
    const sisa = getSisaSaldo(userCode, txOut.account);
    delete pendingAdmin[chatId];
    return `✅ **Transfer Berhasil**\nUser: ${userLabel}\nAkun: ${txOut.account.toUpperCase()}\nSisa Saldo: ${fmt(sisa)}`;
  }

  if (pendingTxs[chatId]) {
    const tx = { ...pendingTxs[chatId], category: text };
    addTx(tx); appendToSheet(tx);
    const sisa = getSisaSaldo(userCode, tx.account);
    delete pendingTxs[chatId];
    return `✅ **Berhasil mencatat: ${text}**\nUser: ${userLabel}\nAkun: ${tx.account.toUpperCase()}\nSisa Saldo: ${fmt(sisa)}`;
  }

  // --- PARSER ---
  const result = parseInput(text, userCode);
  if (result.type === 'error') return isGroup ? null : "❓ Perintah tidak dikenali.";

  if (result.type === 'transfer') {
    pendingAdmin[chatId] = { txOut: result.txOut, txIn: result.txIn };
    return `🔄 **Transfer (${userLabel})**\nAkun: ${result.txOut.account.toUpperCase()} ➡️ ${result.txIn.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.txOut.amount))}\n\n**Biaya Admin?** (Ketik 0 jika gratis)`;
  }

  if (result.type === 'koreksi' || lowText === 'koreksi') {
    const last = deleteLastTx(userCode);
    if (last) {
      const reverseTx = { ...last, amount: -last.amount, note: `[CORRECTION] ${last.note}` };
      appendToSheet(reverseTx).catch(console.error);
      const sisa = getSisaSaldo(userCode, last.account);
      return `↩️ **UNDO BERHASIL**\nUser: ${userLabel}\nAkun: ${last.account.toUpperCase()}\nDihapus: ${last.note}\nSisa Saldo: ${fmt(sisa)}`;
    }
    return "❌ Tidak ada data.";
  }

  if (result.type === 'tx') {
    if (result.category === 'Lainnya') {
      pendingTxs[chatId] = result.tx;
      return `📂 **Pilih Kategori:**\nKetik kategori untuk: *${result.tx.note}*`;
    }
    addTx(result.tx); appendToSheet(result.tx);
    const sisa = getSisaSaldo(userCode, result.tx.account);
    return `✅ **Berhasil mencatat: ${result.tx.category}**\nUser: ${userLabel}\nAkun: ${result.tx.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.tx.amount))}\nSisa Saldo: ${fmt(sisa)}`;
  }
};

pollUpdates(handleMessage);

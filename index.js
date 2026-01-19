import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, getFileLink, deleteMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, getTotalCCHariIni, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet, overwriteSheet } from "./sheets.js";
import { CATEGORIES } from "./categories.js";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo v8.0 Active (Group Optimized)"));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

// --- INIT ---
initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

// STATE
const pendingTxs = {};      
const pendingAdmin = {};    

// --- AUTO BACKUP ---
cron.schedule('58 */14 * * * *', async () => {
  const adminId = process.env.TELEGRAM_USER_ID; 
  if (adminId && fs.existsSync('myfinance.db')) {
     await sendDocument(adminId, 'myfinance.db', `📦 Auto-Backup DB\n⏰ ${new Date().toLocaleString("id-ID")}`, true);
  }
});

const handleMessage = async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text ? msg.text.trim() : "";
  const lowText = text.toLowerCase();

  // AUTHENTICATION (Support Group & Private)
  const isMalvin = userId === parseInt(process.env.TELEGRAM_USER_ID);
  const isYovita = userId === parseInt(process.env.USER_ID_PARTNER);
  const isAllowedGroup = chatId === -5047317862; // ID Grup dari log Anda

  if (!isMalvin && !isYovita) {
    if (!isAllowedGroup) console.log(`Unauthorized access from: ${chatId}`);
    return; 
  }

  const userCode = isMalvin ? 'M' : 'Y';
  const userName = isMalvin ? 'MALVIN' : 'YOVITA';

  // --- LOGIKA PERINTAH (TANPA "/") ---
  
  if (lowText === 'menu' || lowText === 'help' || lowText === '/start') {
    return `🏠 **MENU BOT MAYO v8.0**\n${line}\n` +
           `• Ketik transaksi langsung: \`makan 50k\`\n` +
           `• \`Saldo\` : Cek posisi keuangan\n` +
           `• \`Laporan\` : Download PDF\n` +
           `• \`Sync pull\` : Ambil data dari Sheets\n` +
           `• \`Sync push\` : Upload data ke Sheets\n` +
           `• \`Koreksi\` : Batalkan transaksi terakhir`;
  }

  if (lowText === 'sync pull') {
    await sendMessage(chatId, "☁️ Mengunduh data dari Google Sheets...");
    const data = await downloadFromSheet();
    if (data && data.length > 0) {
      const count = rebuildDatabase(data);
      return `✅ Berhasil! ${count} data dipulihkan ke database lokal.`;
    }
    return "❌ Gagal mengunduh data.";
  }

  if (lowText === 'sync push') {
    const allData = getAllTransactions();
    await sendMessage(chatId, `🔄 Mengunggah ${allData.length} data ke Sheets...`);
    const success = await overwriteSheet(allData);
    return success ? "✅ Sinkronisasi Berhasil!" : "❌ Gagal Push Data.";
  }

  if (lowText === 'saldo' || lowText === 'cek saldo') {
    const rekap = getRekapLengkap();
    let res = `💰 **POSISI SALDO (${userName})**\n${line}\n`;
    const userRows = rekap.rows.filter(r => r.user === userCode);
    if (userRows.length === 0) return `⚠️ Belum ada saldo tercatat untuk ${userName}.`;
    
    let total = 0;
    userRows.forEach(r => {
      res += `🔹 ${r.account.toUpperCase().padEnd(8)}: ${fmt(r.balance)}\n`;
      if (r.account !== 'cc') total += r.balance;
    });
    res += `${line}\n*Total Aset: ${fmt(total)}*`;
    return res;
  }

  if (lowText === 'laporan' || lowText === 'history') {
    await sendMessage(chatId, "📄 Sedang membuat laporan PDF...");
    const data = getLatestTransactions(100);
    const filePath = await createPDF(data, `LAPORAN ${userName}`);
    await sendDocument(chatId, filePath, `Rincian 100 transaksi terakhir (${userName})`);
    return null;
  }

  // LOGIKA PENDING STATE (Biaya Admin Transfer)
  if (pendingAdmin[chatId] && !isNaN(text)) {
    const { txOut, txIn } = pendingAdmin[chatId];
    const fee = parseFloat(text);
    addTx(txOut); addTx(txIn);
    appendToSheet(txOut); appendToSheet(txIn);
    if (fee > 0) {
      const txFee = { ...txOut, amount: -fee, category: 'Tagihan', note: `Admin Transfer: ${txOut.note}` };
      addTx(txFee); appendToSheet(txFee);
    }
    delete pendingAdmin[chatId];
    return `✅ Transfer Berhasil dicatat${fee > 0 ? ` + Admin ${fmt(fee)}` : ''}.`;
  }

  // LOGIKA PENDING STATE (Kategori Baru)
  if (pendingTxs[chatId]) {
    const tx = { ...pendingTxs[chatId], category: text };
    addTx(tx); appendToSheet(tx);
    delete pendingTxs[chatId];
    return `✅ Berhasil dicatat di kategori **${text}**.`;
  }

  // --- PARSER INPUT (TRANSAKSI) ---
  const result = parseInput(text, userCode);
  
  if (result.type === 'error') {
    if (chatId < 0) return null; // Jika di grup dan bukan perintah, abaikan
    return "❓ Perintah tidak dikenali. Ketik `Menu` untuk bantuan.";
  }

  if (result.type === 'transfer') {
    pendingAdmin[chatId] = { txOut: result.txOut, txIn: result.txIn };
    return `🔄 **Transfer ${userName}**\nKe: ${result.txIn.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.txOut.amount))}\n\n**Biaya Admin?** (Ketik '0' jika gratis)`;
  }

  if (result.type === 'adjustment') {
    addTx(result.tx); appendToSheet(result.tx);
    return `🛠 **Adjustment**\nSaldo ${result.tx.account.toUpperCase()} diset menjadi ${fmt(result.tx.amount)}.`;
  }

  if (result.type === 'koreksi' || lowText === 'undo') {
    const lastTx = deleteLastTx(userCode);
    if (lastTx) {
      const reverseTx = { ...lastTx, amount: -lastTx.amount, note: `[CORRECTION] ${lastTx.note}` };
      appendToSheet(reverseTx).catch(console.error);
      return `↩️ **UNDO BERHASIL (${userName})**\nDihapus: ${lastTx.note} (${fmt(Math.abs(lastTx.amount))})`;
    }
    return "❌ Tidak ada data milik Anda untuk dihapus.";
  }

  if (result.type === 'tx') {
    if (result.category === 'Lainnya') {
      pendingTxs[chatId] = result.tx;
      const buttons = CATEGORIES.map(c => `\`${c.cat}\``).join(', ');
      return `📂 **Pilih Kategori (${userName}):**\n${buttons}\n\nAtau ketik kategori baru.`;
    }
    addTx(result.tx); appendToSheet(result.tx);
    return `✅ **Tercatat (${userName})**\n${result.tx.category}: ${fmt(Math.abs(result.tx.amount))}\nKet: ${result.tx.note}`;
  }
};

pollUpdates(handleMessage);

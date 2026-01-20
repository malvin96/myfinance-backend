import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, deleteMessage } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet, overwriteSheet } from "./sheets.js";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo v8.2 Active"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

const pendingAdmin = {};    
const LIQUID_LIST = ['bca', 'cash', 'gopay', 'ovo', 'shopeepay'];
const ASSET_LIST = ['bibit', 'mirrae', 'bca sekuritas'];
let lastBackupMsgId = null; // [BARU] Menyimpan ID pesan backup terakhir

// --- [FITUR KUNCI] AUTO BACKUP CRON (14 Menit 58 Detik) ---
// Menjalankan sync push otomatis & backup DB setiap interval 14 menit 58 detik
cron.schedule('58 */14 * * * *', async () => {
  try {
    // 1. Push ke Google Sheet
    const allData = getAllTransactions();
    if (allData.length > 0) {
      const success = await overwriteSheet(allData);
      if (success) console.log(`[AUTO BACKUP] Success push ${allData.length} rows at ${new Date().toLocaleTimeString()}`);
    }

    // 2. [BARU] Kirim Backup DB ke Telegram Owner
    const ownerId = process.env.TELEGRAM_USER_ID;
    if (ownerId) {
        // Hapus pesan backup sebelumnya jika ada
        if (lastBackupMsgId) {
            await deleteMessage(ownerId, lastBackupMsgId);
        }
        // Kirim file DB baru
        const caption = `💾 **AUTO BACKUP DATABASE**\n📅 ${new Date().toLocaleString('id-ID')}\n_Backup otomatis setiap ±15 menit._`;
        const result = await sendDocument(ownerId, "myfinance.db", caption, true); // Silent = true
        
        // Simpan ID pesan untuk dihapus nanti
        if (result && result.ok && result.result) {
            lastBackupMsgId = result.result.message_id;
        }
    }

  } catch (err) {
    console.error("[AUTO BACKUP ERROR]", err);
  }
});

const getSisaSaldo = (user, account) => {
  const rekap = getRekapLengkap();
  const row = rekap.rows.find(r => r.user === user && r.account.toLowerCase() === account.toLowerCase());
  return row ? row.balance : 0;
};

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

  // 1. PERINTAH SISTEM
  if (lowText === 'menu' || lowText === 'help' || lowText === '/start') {
    return `🤖 **SISTEM KEUANGAN MAYO**\n${line}\n` +
           `💡 *PANDUAN CEPAT*\n` +
           `• Ketik langsung: \`makan 50k\`\n` +
           `  _(Bot otomatis deteksi kategori)_\n\n` +
           `💰 *KEUANGAN*\n` +
           `• \`Saldo\` : Cek posisi keuangan\n` +
           `• \`History\` : Lihat transaksi terakhir\n` +
           `• \`History (20)\` : Lihat 20 data, dst\n` +
           `• \`Laporan\` : Download PDF Lengkap\n\n` +
           `🛠 *ALAT BANTU*\n` +
           `• \`ss [akun] [nominal]\` : Set Saldo\n` +
           `• \`tf [akun] ke [tujuan] [nom]\` : Transfer\n` +
           `• \`Koreksi\` : Hapus input terakhir\n` +
           `• \`Sync pull\` : Ambil data Sheet\n` +
           `• \`Sync push\` : Backup paksa ke Sheet`;
  }

  if (lowText === 'saldo' || lowText === 'cek saldo') {
    const rekap = getRekapLengkap();
    const buildUI = (code, label) => {
      const rows = rekap.rows.filter(r => r.user === code);
      if (rows.length === 0) return `Belum ada saldo untuk ${label}\n`;
      let s = `💰 **POSISI SALDO (${label})**\n${line}\n*--- LIQUID ---*\n`;
      rows.filter(r => LIQUID_LIST.includes(r.account.toLowerCase())).forEach(r => s += `🔹 ${r.account.toUpperCase().padEnd(9)}: ${fmt(r.balance)}\n`);
      const assets = rows.filter(r => ASSET_LIST.includes(r.account.toLowerCase()));
      if (assets.length > 0) s += `\n*--- ASET ---*\n`, assets.forEach(r => s += `🔸 ${r.account.toUpperCase().padEnd(9)}: ${fmt(r.balance)}\n`);
      const total = rows.filter(r => r.account !== 'cc').reduce((a, b) => a + b.balance, 0);
      return s + `${line}\n*Total Kekayaan: ${fmt(total)}*\n\n`;
    };
    return buildUI('M', 'MALVIN') + buildUI('Y', 'YOVITA');
  }

  if (lowText.startsWith('history')) {
    // [FIX] Sanitasi input agar format (10) bisa terbaca
    const numOnly = lowText.replace(/[^0-9]/g, ''); 
    const limit = parseInt(numOnly) || 10;
    
    const data = getLatestTransactions(limit);
    let res = `📜 **HISTORY TRANSAKSI (${limit} Data)**\n${line}\n`;
    
    data.forEach(r => {
      // [FIX] Replace spasi dengan 'T' agar valid ISO format di JS
      let dateStr = "Invalid Date";
      try {
          const cleanTs = r.timestamp ? r.timestamp.replace(" ", "T") : "";
          dateStr = new Date(cleanTs).toLocaleDateString('id-ID', {day:'2-digit', month:'2-digit'});
      } catch (e) { dateStr = "??/??"; }

      res += `${dateStr} [${r.user}] ${r.account.toUpperCase()} | ${fmt(r.amount)}\n   └ ${r.note}\n`;
    });
    return res + `${line}\n*Menampilkan ${data.length} data terakhir.*`;
  }

  if (lowText === 'sync pull') {
    await sendMessage(chatId, "☁️ Sedang mengunduh data dari Google Sheet...");
    const data = await downloadFromSheet();
    if (data.length > 0) {
        const count = rebuildDatabase(data);
        return `✅ Berhasil Pull ${count} data ke database lokal.`;
    }
    return "❌ Gagal mengunduh data atau Sheet kosong.";
  }

  if (lowText === 'sync push') {
    const allData = getAllTransactions();
    await overwriteSheet(allData);
    return `✅ Berhasil Push ${allData.length} data ke Google Sheets secara manual.`;
  }

  if (lowText === 'laporan') {
    await sendMessage(chatId, "📄 Sedang membuat laporan PDF...");
    const filePath = await createPDF(getAllTransactions(), "LAPORAN KEUANGAN LENGKAP");
    await sendDocument(chatId, filePath, "Rekap saldo & history lengkap.");
    return null;
  }

  if (lowText === 'koreksi' || lowText === 'undo') {
    const last = deleteLastTx(userCode);
    if (last) return `↩️ **UNDO BERHASIL**\nUser: ${userLabel}\nAkun: ${last.account.toUpperCase()}\nDihapus: ${last.note}\nSisa Saldo: ${fmt(getSisaSaldo(userCode, last.account))}`;
    return "❌ Tidak ada data transaksi Anda yang bisa dihapus.";
  }

  // 2. LOGIKA PENDING FEE TRANSFER
  if (pendingAdmin[chatId] && !isNaN(text.replace(/k/gi, '000'))) {
    const { txOut, txIn } = pendingAdmin[chatId];
    const fee = parseFloat(text.replace(/k/gi, '000'));
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

  // 3. PARSER TRANSAKSI (GREEDY)
  const result = parseInput(text, userCode);
  
  if (result.type === 'error') {
    const systemCmds = ['saldo', 'menu', 'history', 'laporan', 'sync', 'koreksi', 'undo', 'ss', 'tf'];
    if (systemCmds.some(c => lowText.includes(c))) return `❓ Perintah salah. Ketik \`Menu\` untuk bantuan.`;
    return null; 
  }

  if (result.type === 'adjustment') {
    addTx(result.tx); appendToSheet(result.tx);
    return `🛠 **ADJUSTMENT BERHASIL**\nUser: ${userLabel}\nAkun: ${result.tx.account.toUpperCase()}\nSaldo diset ke: ${fmt(result.tx.amount)}`;
  }

  if (result.type === 'transfer') {
    pendingAdmin[chatId] = { txOut: result.txOut, txIn: result.txIn };
    const target = result.txIn.user !== result.txOut.user ? `Partner (${result.txIn.user === 'Y' ? 'Yovita' : 'Malvin'})` : result.txIn.account.toUpperCase();
    return `🔄 **Transfer (${userLabel})**\nAkun: ${result.txOut.account.toUpperCase()} ➡️ ${target}\nNominal: ${fmt(Math.abs(result.txOut.amount))}\n\n**Biaya Admin?** (Ketik 0 jika gratis)`;
  }

  if (result.type === 'tx') {
    addTx(result.tx); appendToSheet(result.tx);
    return `✅ **Berhasil: ${result.tx.category}**\nUser: ${userLabel}\nAkun: ${result.tx.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.tx.amount))}\nSisa Saldo: ${fmt(getSisaSaldo(userCode, result.tx.account))}`;
  }
};

pollUpdates(handleMessage);

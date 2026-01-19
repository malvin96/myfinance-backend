import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument } from "./telegram.js";
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

  // --- 1. PERINTAH SISTEM (PRIORITAS) ---
  if (lowText === 'menu' || lowText === 'help' || lowText === '/start') {
    return "🏠 **MENU BOT**\n" + line + "\n• Ketik langsung: `makan 50k` (Greedy)\n• `Saldo` : Cek posisi keuangan\n• `ss [akun] [nominal]` : Set Saldo\n• `tf [akun] ke [partner/akun] [nom]` : Transfer\n• `History 20` : Cek transaksi terakhir\n• `Laporan` : Download Rekap PDF\n• `Sync pull` : Download data Sheet\n• `Sync push` : Upload data ke Sheet\n• `Koreksi` : Hapus data terakhir";
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

  if (lowText === 'sync pull') {
    await sendMessage(chatId, "☁️ Mengunduh data Sheet...");
    const data = await downloadFromSheet();
    return data.length > 0 ? `✅ Berhasil Pull ${rebuildDatabase(data)} data.` : "❌ Gagal mengunduh data.";
  }

  if (lowText === 'sync push') {
    const allData = getAllTransactions();
    await overwriteSheet(allData);
    return `✅ Berhasil Push ${allData.length} data ke Google Sheets.`;
  }

  if (lowText === 'laporan') {
    await sendMessage(chatId, "📄 Membuat laporan PDF...");
    const filePath = await createPDF(getAllTransactions(), "LAPORAN KEUANGAN LENGKAP");
    await sendDocument(chatId, filePath, "Rekap saldo & history lengkap.");
    return null;
  }

  // --- 2. PENDING STATES ---
  if (pendingAdmin[chatId] && !isNaN(text)) {
    const { txOut, txIn } = pendingAdmin[chatId];
    const fee = parseFloat(text);
    addTx(txOut); addTx(txIn); appendToSheet(txOut); appendToSheet(txIn);
    if (fee > 0) {
      const txFee = { ...txOut, amount: -fee, category: 'Tagihan', note: `Admin Transfer: ${txOut.note}` };
      addTx(txFee); appendToSheet(txFee);
    }
    const sisa = getSisaSaldo(userCode, txOut.account);
    delete pendingAdmin[chatId];
    return `✅ **Transfer Berhasil**\nUser: ${userLabel}\nAkun: ${txOut.account.toUpperCase()}\nSisa Saldo: ${fmt(sisa)}`;
  }

  // --- 3. PARSER TRANSAKSI ---
  const result = parseInput(text, userCode);
  
  if (result.type === 'error') {
    const cmdList = ['saldo', 'menu', 'history', 'laporan', 'sync', 'koreksi', 'undo'];
    if (cmdList.some(c => lowText.includes(c))) return `❓ Perintah tidak dikenali. Ketik \`Menu\` untuk bantuan.`;
    if (lowText.split(' ').length <= 3 && !isGroup) return `⚠️ Gagal mencatat. Nominal tidak ditemukan atau format salah (Contoh: \`makan 50k\`).`;
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
    const sisa = getSisaSaldo(userCode, result.tx.account);
    return `✅ **Berhasil mencatat: ${result.tx.category}**\nUser: ${userLabel}\nAkun: ${result.tx.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.tx.amount))}\nSisa Saldo: ${fmt(sisa)}`;
  }

  if (result.type === 'koreksi' || lowText === 'koreksi' || lowText === 'undo') {
    const last = deleteLastTx(userCode);
    if (last) {
      const sisa = getSisaSaldo(userCode, last.account);
      return `↩️ **UNDO BERHASIL**\nUser: ${userLabel}\nAkun: ${last.account.toUpperCase()}\nDihapus: ${last.note}\nSisa Saldo: ${fmt(sisa)}`;
    }
    return "❌ Tidak ada data.";
  }
};
pollUpdates(handleMessage);

import express from "express";
import fs from 'fs';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet, overwriteSheet } from "./sheets.js";

const app = express();
app.get("/", (req, res) => res.send("Bot MaYo Active"));
app.listen(process.env.PORT || 3000);

initDB();
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const line = "━━━━━━━━━━━━━━━━━━━";

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

  // --- COMMANDS ---
  if (lowText === 'menu' || lowText === 'help' || lowText === '/start') {
    return "🏠 **MENU BOT**\n" + line + "\n• Ketik langsung: `makan 50k`\n• `Saldo` : Cek posisi keuangan\n• `History 20` : Cek transaksi terakhir\n• `Laporan` : Rekap PDF Lengkap\n• `Sync pull` : Download data Sheet\n• `Sync push` : Upload data ke Sheet\n• `Koreksi` : Hapus data terakhir";
  }

  if (lowText.startsWith('history')) {
    const limit = parseInt(lowText.replace('history', '').trim()) || 10;
    const data = getLatestTransactions(limit);
    let res = `📜 **HISTORY TRANSAKSI**\n${line}\n`;
    data.forEach(r => {
      const t = new Date(r.timestamp).toLocaleDateString('id-ID', {day:'2-digit', month:'2-digit'});
      res += `${t} [${r.user}] ${r.account.toUpperCase()} | ${fmt(r.amount)}\n   └ ${r.note}\n`;
    });
    return res + `${line}\n*Menampilkan ${data.length} data.*`;
  }

  if (lowText === 'saldo' || lowText === 'cek saldo') {
    const rekap = getRekapLengkap();
    const buildUI = (code, label) => {
      const rows = rekap.rows.filter(r => r.user === code);
      if (rows.length === 0) return `Belum ada data untuk ${label}\n`;
      let s = `💰 **POSISI SALDO (${label})**\n${line}\n*--- LIQUID ---*\n`;
      rows.filter(r => LIQUID_LIST.includes(r.account.toLowerCase())).forEach(r => s += `🔹 ${r.account.toUpperCase().padEnd(9)}: ${fmt(r.balance)}\n`);
      const assets = rows.filter(r => ASSET_LIST.includes(r.account.toLowerCase()));
      if (assets.length > 0) {
        s += `\n*--- ASET ---*\n`;
        assets.forEach(r => s += `🔸 ${r.account.toUpperCase().padEnd(9)}: ${fmt(r.balance)}\n`);
      }
      const total = rows.filter(r => r.account !== 'cc').reduce((a, b) => a + b.balance, 0);
      return s + `${line}\n*Total Kekayaan: ${fmt(total)}*\n\n`;
    };
    return buildUI('M', 'MALVIN') + buildUI('Y', 'YOVITA');
  }

  if (lowText === 'laporan') {
    await sendMessage(chatId, "📄 Membuat laporan PDF...");
    const data = getAllTransactions();
    const filePath = await createPDF(data, "LAPORAN KEUANGAN LENGKAP");
    await sendDocument(chatId, filePath, "Rekap saldo & history lengkap (AI Friendly).");
    return null;
  }

  // --- LOGIKA INPUT & KLARIFIKASI ---
  const result = parseInput(text, userCode);
  
  if (result.type === 'error') {
    const cmdList = ['saldo', 'menu', 'history', 'laporan', 'sync', 'koreksi'];
    if (cmdList.some(c => lowText.includes(c))) return `❓ Perintah tidak dikenali. Ketik \`Menu\` untuk bantuan.`;
    if (lowText.split(' ').length <= 3 && !isGroup) return `⚠️ Gagal mencatat. Nominal tidak ditemukan (Contoh: \`makan 50k\`).`;
    return null; 
  }

  if (result.type === 'tx') {
    addTx(result.tx); appendToSheet(result.tx);
    const sisa = getSisaSaldo(userCode, result.tx.account);
    return `✅ **Berhasil mencatat: ${result.tx.category}**\nUser: ${userLabel}\nAkun: ${result.tx.account.toUpperCase()}\nNominal: ${fmt(Math.abs(result.tx.amount))}\nSisa Saldo: ${fmt(sisa)}`;
  }

  if (result.type === 'koreksi' || lowText === 'koreksi') {
    const last = deleteLastTx(userCode);
    if (last) {
      const sisa = getSisaSaldo(userCode, last.account);
      return `↩️ **UNDO BERHASIL**\nUser: ${userLabel}\nAkun: ${last.account.toUpperCase()}\nDihapus: ${last.note}\nSisa Saldo: ${fmt(sisa)}`;
    }
    return "❌ Tidak ada data untuk dihapus.";
  }
};
pollUpdates(handleMessage);

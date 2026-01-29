import express from "express";
import fs from 'fs';
import http from 'http';
import https from 'https';
import cron from 'node-cron';
import { pollUpdates, sendMessage, sendDocument, deleteMessage, downloadFile } from "./telegram.js";
import { parseInput } from "./parser.js";
import { initDB, addTx, getRekapLengkap, deleteLastTx, rebuildDatabase, getLatestTransactions, getAllTransactions, getTotalCCHariIni, importFromDBFile, searchTransactions, getDailyTransactions } from "./db.js";
import { createPDF } from "./export.js";
import { appendToSheet, downloadFromSheet } from "./sheets.js"; 
import { getCategoryEmoji } from "./categories.js"; 

const app = express();
const botStartTime = new Date(); // Catat waktu bot mulai

app.get("/", (req, res) => res.send("Bot MaYo Locked v12.2 (Uptime & Resilience Mode)"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok", uptime: botStartTime }));

// [FITUR] Keep-Alive Mechanism (Render Optimized)
const startKeepAlive = () => {
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
        if (!url) return;
        const protocol = url.startsWith("https") ? https : http;
        protocol.get(url, (res) => {
            // Ping sukses
        }).on('error', (e) => console.error("Keep-Alive Error:", e.message));
    }, 10 * 60 * 1000); // Setiap 10 menit
};

const fmt = (num) => new Intl.NumberFormat("id-ID").format(num);

async function handleMessage(msg) {
    const text = msg.text;
    if (!text) return null;
    const lowText = text.toLowerCase().trim();
    const chatId = msg.chat.id;
    const userCode = (chatId.toString() === process.env.ID_MALVIN) ? 'M' : 'Y';
    const userLabel = userCode === 'M' ? 'MALVIN' : 'YOVITA';
    const line = "────────────────";

    // FITUR BARU: STATUS
    if (lowText === 'status') {
        const diff = Math.floor((new Date() - botStartTime) / 1000);
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const rekap = getRekapLengkap();
        return `🤖 **STATUS BOT MAYO**\n${line}\n` +
               `✅ Status: **AKTIF / STABIL**\n` +
               `🕒 Uptime: ${hours}j ${mins}m\n` +
               `📊 Database: ${fmt(rekap.rows.length)} akun aktif\n` +
               `☁️ Server: Render Optimized\n` +
               `📅 WITA: ${new Date().toLocaleString('id-ID', {timeZone: 'Asia/Makassar'})}`;
    }

    const result = parseInput(text, userCode);
    
    if (result.type === 'error') {
        if (['ss', 'tf', 'laporan', 'rekap', 'cari', 'sync', 'koreksi'].some(x => lowText.startsWith(x))) 
            return `⚠️ **FORMAT SALAH**\nKetik \`menu\` untuk bantuan format.`;
        return null;
    }

    if (result.type === 'adjustment') {
        addTx(result.tx); appendToSheet(result.tx);
        return `✅ SALDO DIUPDATE\n👤 ${userLabel} | 🏦 ${result.tx.account.toUpperCase()}\n💰 ${fmt(result.tx.amount)}`;
    }

    if (result.type === 'transfer') {
        addTx(result.txOut); appendToSheet(result.txOut);
        addTx(result.txIn);  appendToSheet(result.txIn);
        const uOut = result.txOut.user === 'M' ? 'MALVIN' : 'YOVITA';
        const uIn = result.txIn.user === 'M' ? 'MALVIN' : 'YOVITA';
        return `🔄 **TRANSFER BERHASIL**\n${line}\n` +
               `📤 ${result.txOut.account.toUpperCase()} (${uOut})\n` +
               `📥 ${result.txIn.account.toUpperCase()} (${uIn})\n` +
               `💰 **${fmt(Math.abs(result.txOut.amount))}**\n` +
               `🏷️ Kategori: Transfer`;
    }

    if (result.type === 'tx') {
        addTx(result.tx); appendToSheet(result.tx);
        const catEmoji = getCategoryEmoji(result.tx.category);
        return `✅ **BERHASIL DICATAT**\n${line}\n` +
               `👤 ${userLabel} | 🏦 ${result.tx.account.toUpperCase()}\n` +
               `💰 **${fmt(result.tx.amount)}**\n` +
               `🏷️ ${catEmoji} ${result.tx.category}\n` +
               `📝 ${result.tx.note}`;
    }

    return null;
}

// Inisialisasi
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initDB();
    startKeepAlive();
    pollUpdates(handleMessage);
});

// Cron Job Backup (Jam 23:55 WITA)
cron.schedule('55 23 * * *', async () => {
    console.log("⏰ Menjalankan Auto-Sync Malam...");
    try {
        const data = await downloadFromSheet();
        if (data.length > 0) rebuildDatabase(data);
    } catch (e) { console.error("Cron Error:", e.message); }
}, { timezone: "Asia/Makassar" });

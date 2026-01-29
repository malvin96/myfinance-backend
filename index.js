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
const botStartTime = new Date(); // Mencatat waktu nyala untuk fitur Status

app.get("/", (req, res) => res.send("Bot MaYo Finance v12.5 (Stable/Locked)"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok", uptime: botStartTime }));

// [FITUR] Keep-Alive Internal (Backup untuk Uptime Robot)
const startKeepAlive = () => {
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
        if (!url) return;
        const protocol = url.startsWith("https") ? https : http;
        protocol.get(url, (res) => {
            // Ping sukses
        }).on('error', (e) => console.error("Keep-Alive Error:", e.message));
    }, 10 * 60 * 1000); // 10 menit
};

const fmt = (num) => new Intl.NumberFormat("id-ID").format(num);

async function handleMessage(msg) {
    const text = msg.text;
    if (!text) return null;
    const lowText = text.toLowerCase().trim();
    const chatId = msg.chat.id;
    // Identifikasi User berdasarkan ID Telegram
    const userCode = (chatId.toString() === process.env.ID_MALVIN) ? 'M' : 'Y';
    const userLabel = userCode === 'M' ? 'MALVIN' : 'YOVITA';
    const line = "────────────────";

    // --- 1. FITUR MENU & BANTUAN ---
    if (lowText === 'menu') {
        return `🏠 **MENU MAYO FINANCE**\n${line}\n` +
               `💰 **Input Cepat:**\n\`15k bca mkn siang\`\n\`50rb gopay bensin\`\n\n` +
               `🔄 **Transfer & Saldo:**\n\`tf 50k bca ke gopay\`\n\`ss bca 1.500.000\`\n\n` +
               `📊 **Laporan & Data:**\n• \`rekap\` : Lihat saldo semua akun\n• \`daily\` : Transaksi hari ini\n• \`history\` : 10 transaksi terakhir\n• \`cari [kata]\` : Cari transaksi\n\n` +
               `⚙️ **Sistem:**\n• \`sync\` : Ambil data dari Google Sheet\n• \`export\` : Download PDF Laporan\n• \`backup\` : File Database (.db)\n• \`koreksi\` : Hapus transaksi terakhir\n• \`status\` : Cek kesehatan bot`;
    }

    // --- 2. FITUR REKAP SALDO ---
    if (lowText === 'rekap') {
        const rekap = getRekapLengkap();
        if (rekap.rows.length === 0) return "📭 Belum ada data transaksi.";
        
        let res = `📊 **REKAP SALDO AKHIR**\n${line}\n`;
        let currentU = '';
        rekap.rows.forEach(r => {
            const u = r.user === 'M' ? '👤 **MALVIN**' : '👤 **YOVITA**';
            if (u !== currentU) {
                res += `\n${u}\n`;
                currentU = u;
            }
            res += `• ${r.account.toUpperCase()}: ${fmt(r.balance)}\n`;
        });
        res += `\n${line}\n💰 **TOTAL: Rp ${fmt(rekap.totalWealth)}**`;
        return res;
    }

    // --- 3. FITUR STATUS (REQUEST BARU) ---
    if (lowText === 'status') {
        const diff = Math.floor((new Date() - botStartTime) / 1000);
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const rekap = getRekapLengkap(); // Hitung jumlah baris data
        
        return `🤖 **STATUS BOT MAYO**\n${line}\n` +
               `✅ Sistem: **ONLINE**\n` +
               `🕒 Uptime: ${hours} Jam ${mins} Menit\n` +
               `📡 Koneksi: Stabil (Uptime Robot Monitored)\n` +
               `📊 Database: ${rekap.rows.length} Akun Aktif\n` +
               `📅 Server Time: ${new Date().toLocaleString('id-ID', {timeZone: 'Asia/Makassar'})}`;
    }

    // --- 4. FITUR SYNC (SHEET -> DB) ---
    if (lowText === 'sync') {
        await sendMessage(chatId, "🔄 **SYNC STARTED**\nSedang mengambil data dari Google Sheet...");
        try {
            const data = await downloadFromSheet();
            if (data && data.length > 0) {
                const count = rebuildDatabase(data);
                return `✅ **SYNC SUKSES**\n${line}\nDatabase telah diperbarui dengan ${count} transaksi dari Sheet.`;
            } else {
                return "⚠️ Sheet kosong atau gagal mengambil data.";
            }
        } catch (e) {
            return `❌ Gagal Sync: ${e.message}`;
        }
    }

    // --- 5. FITUR LOG HARIAN & HISTORY ---
    if (lowText === 'daily' || lowText === 'history') {
        const txs = lowText === 'daily' ? getDailyTransactions() : getLatestTransactions(10);
        if (txs.length === 0) return `📭 Tidak ada transaksi ${lowText === 'daily' ? 'hari ini' : 'terbaru'}.`;
        
        let res = `📑 **${lowText.toUpperCase()} TRANSAKSI**\n${line}\n`;
        txs.forEach(t => {
            const emoji = getCategoryEmoji(t.category);
            // Format: M|BCA|15.000|🍔Makan
            res += `${t.user}|${t.account.toUpperCase()}|${fmt(t.amount)}|${emoji}${t.note || t.category}\n`;
        });
        return res;
    }

    // --- 6. FITUR PENCARIAN ---
    if (lowText.startsWith('cari ')) {
        const keyword = lowText.replace('cari ', '').trim();
        if (!keyword) return "⚠️ Masukkan kata kunci. Contoh: `cari sate`";
        
        const txs = searchTransactions(keyword);
        if (txs.length === 0) return `🔍 Tidak ditemukan transaksi untuk "${keyword}"`;
        
        let res = `🔍 **HASIL CARI: ${keyword.toUpperCase()}**\n${line}\n`;
        txs.slice(0, 15).forEach(t => { // Batasi 15 hasil
             res += `• ${t.timestamp.split(' ')[0]} | ${fmt(t.amount)} | ${t.note}\n`;
        });
        return res;
    }

    // --- 7. FITUR EXPORT PDF & BACKUP ---
    if (lowText === 'export') {
        await sendMessage(chatId, "⏳ Sedang memproses PDF...");
        try {
            const allTxs = getAllTransactions();
            const pdfPath = await createPDF(allTxs);
            await sendDocument(chatId, pdfPath, "📊 Laporan Keuangan Lengkap");
            fs.unlinkSync(pdfPath); // Hapus file temp
            return null; // Tidak perlu reply text lagi
        } catch (e) {
            return `❌ Gagal Export: ${e.message}`;
        }
    }

    if (lowText === 'backup') {
        await sendDocument(chatId, "./myfinance.db", "📦 Backup Database SQLite");
        return null;
    }

    // --- 8. FITUR KOREKSI (HAPUS TERAKHIR) ---
    if (lowText === 'koreksi') {
        const deleted = deleteLastTx(userCode);
        if (deleted) {
            return `🗑️ **TRANSAKSI DIHAPUS**\n${line}\n` +
                   `🏦 ${deleted.account.toUpperCase()}\n` +
                   `💰 ${fmt(deleted.amount)}\n` +
                   `📝 ${deleted.note}`;
        }
        return "⚠️ Tidak ada transaksi terakhir yang ditemukan untuk Anda.";
    }

    // --- 9. PARSER TRANSAKSI (LOGIKA UTAMA) ---
    const result = parseInput(text, userCode);

    // Handle Error Format
    if (result.type === 'error') {
        // Cek jika user mencoba perintah system tapi typo atau salah format
        if (['ss', 'tf', 'laporan', 'rekap', 'cari', 'sync'].some(x => lowText.startsWith(x))) {
            return `⚠️ **FORMAT TIDAK DIKENALI**\nKetik \`menu\` untuk melihat daftar perintah.`;
        }
        return null; // Abaikan chat biasa (bukan command)
    }

    // Handle Adjustment (Set Saldo)
    if (result.type === 'adjustment') {
        addTx(result.tx); appendToSheet(result.tx);
        return `✅ **SALDO DIUPDATE**\n${line}\n👤 ${userLabel} | 🏦 ${result.tx.account.toUpperCase()}\n💰 Posisi Baru: **${fmt(result.tx.amount)}**`;
    }

    // Handle Transfer
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

    // Handle Transaksi Biasa
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

// Inisialisasi Server & Bot
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initDB(); // Pastikan DB siap
    startKeepAlive(); // Jalankan keep-alive internal
    pollUpdates(handleMessage); // Mulai polling Telegram
});

// Cron Job: Auto-Sync jam 23:55 WITA
cron.schedule('55 23 * * *', async () => {
    console.log("⏰ Menjalankan Auto-Sync Malam...");
    try {
        const data = await downloadFromSheet();
        if (data.length > 0) rebuildDatabase(data);
    } catch (e) { console.error("Cron Error:", e.message); }
}, { timezone: "Asia/Makassar" });

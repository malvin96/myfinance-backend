import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(chatId, text) {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" }),
    });
    // Log jika token invalid/bot di-block user
    if (res.status === 401 || res.status === 403) console.error("❌ Telegram Auth Error: Cek Token atau Permission");
  } catch (error) { console.error("Telegram SendMessage Error:", error.message); }
}

export async function deleteMessage(chatId, messageId) {
  try {
    await fetch(`${TELEGRAM_API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch (error) { 
    // Silent fail jika pesan sudah terhapus/lama (normal)
  }
}

// [FIXED] Menambahkan Header form-data agar kompatibel dengan Node.js v20+
export async function sendDocument(chatId, filePath, caption = "", silent = false) {
  try {
    if (!fs.existsSync(filePath)) {
        console.error("❌ File tidak ditemukan:", filePath);
        return null;
    }

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', fs.createReadStream(filePath));
    if (caption) form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    if (silent) form.append('disable_notification', 'true');

    // PERBAIKAN KRUSIAL: Tambahkan form.getHeaders()
    const response = await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: "POST",
      body: form,
      headers: form.getHeaders() // Wajib untuk node-fetch + form-data
    });

    return await response.json();
  } catch (error) {
    console.error("❌ Send Document Error:", error.message);
    return null;
  }
}

export async function downloadFile(fileId, destPath) {
  try {
    const response = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const data = await response.json();
    if (!data.ok) return false;

    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) return false;

    await streamPipeline(res.body, fs.createWriteStream(destPath));
    return true;
  } catch (error) {
    console.error("Download File Error:", error.message);
    return false;
  }
}

export async function pollUpdates(handleMessage) {
  let offset = 0;
  console.log("🚀 Bot MaYo Polling Started (Fixed Mode)...");
  
  // Loop Polling Stabil dengan Error Handling
  while (true) {
    try {
      // Timeout 60s agar request tidak menggantung selamanya
      const response = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`, { 
        timeout: 60000 
      });
      
      const data = await response.json();
      if (data.result && Array.isArray(data.result)) {
        for (const update of data.result) {
          if (update.message) {
            // Bungkus handleMessage agar 1 error tidak mematikan seluruh bot
            try {
                const reply = await handleMessage(update.message);
                if (reply) await sendMessage(update.message.chat.id, reply);
            } catch (err) {
                console.error("Handler Error:", err.message);
                await sendMessage(update.message.chat.id, "⚠️ Terjadi kesalahan sistem saat memproses pesan.");
            }
          }
          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      if (error.type === 'request-timeout') {
          // Normal timeout dari Telegram long-polling, abaikan.
      } else {
          console.error("⚠️ Polling Connection Error (Retrying in 5s):", error.message);
          // Tunggu 5 detik sebelum retry agar tidak spam log jika internet putus
          await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}

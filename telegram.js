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
  } catch (error) { }
}

export async function sendDocument(chatId, filePath, caption = "") {
  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", fs.createReadStream(filePath));
    if (caption) form.append("caption", caption);

    await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });
  } catch (error) { console.error("Telegram SendDocument Error:", error.message); }
}

export async function downloadFile(fileId, destPath) {
  try {
    const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (data.ok) {
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Unexpected response ${response.statusText}`);
      await streamPipeline(response.body, fs.createWriteStream(destPath));
      return true;
    }
    return false;
  } catch (error) {
    console.error("Download Error:", error.message);
    return false;
  }
}

export async function pollUpdates(handleMessage) {
  let offset = 0;
  console.log("🚀 Bot MaYo Polling Started (High Resilience Mode)...");
  
  while (true) {
    // AbortController mencegah fetch menggantung selamanya jika internet drop
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); 

    try {
      const response = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`, { 
        signal: controller.signal 
      });
      
      clearTimeout(timeout);

      // Tangani Conflict 409 (biasanya saat deploy/restart)
      if (response.status === 409) {
        console.warn("⚠️ Conflict (409) terdeteksi. Menunggu instance lain mati...");
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }

      const data = await response.json();
      if (data.result && Array.isArray(data.result)) {
        for (const update of data.result) {
          if (update.message) {
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
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
          console.error("🕒 Polling Timeout (Network Reset)");
      } else {
          console.error("⚠️ Polling Error:", error.message);
          await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}

import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(chatId, text) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" }),
    });
  } catch (error) { console.error("Telegram SendMessage Error:", error); }
}

export async function deleteMessage(chatId, messageId) {
  try {
    await fetch(`${TELEGRAM_API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch (error) { 
    console.error("Gagal hapus pesan (mungkin sudah terhapus):", error.message); 
  }
}

export async function sendDocument(chatId, filePath, caption = "", silent = false) {
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    if (silent) form.append('disable_notification', 'true'); 
    form.append('document', fs.createReadStream(filePath));
    
    const response = await fetch(`${TELEGRAM_API}/sendDocument`, { method: "POST", body: form });
    return await response.json(); 
  } catch (error) { 
    console.error("Telegram SendDocument Error:", error); 
    return null;
  }
}

// [FITUR] Helper untuk mendownload file dari Telegram
export async function downloadFile(fileId, destPath) {
  try {
    // 1. Dapatkan Path File dari API
    const response = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const data = await response.json();
    if (!data.ok) return false;

    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;

    // 2. Download Stream
    const res = await fetch(fileUrl);
    if (!res.ok) return false;

    await streamPipeline(res.body, fs.createWriteStream(destPath));
    return true;
  } catch (error) {
    console.error("Download File Error:", error);
    return false;
  }
}

export async function pollUpdates(handleMessage) {
  let offset = 0;
  console.log("Bot MaYo v11.1 Ready (DB Restore Active)...");
  while (true) {
    try {
      const response = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`);
      const data = await response.json();
      if (data.result) {
        for (const update of data.result) {
          if (update.message) {
            const reply = await handleMessage(update.message);
            if (reply) await sendMessage(update.message.chat.id, reply);
          }
          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      console.error("Polling Error:", error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

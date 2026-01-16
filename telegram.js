import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

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

// UPDATE: Tambah parameter 'silent' (Default false)
export async function sendDocument(chatId, filePath, caption = "", silent = false) {
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    // Fitur Silent Mode: True = Tanpa Suara (Notifikasi hening)
    if (silent) form.append('disable_notification', 'true'); 
    form.append('document', fs.createReadStream(filePath));
    
    await fetch(`${TELEGRAM_API}/sendDocument`, { method: "POST", body: form });
  } catch (error) { console.error("Telegram SendDocument Error:", error); }
}

export async function getFileLink(fileId) {
  try {
    const response = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const data = await response.json();
    if (data.ok) {
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
    }
  } catch (error) { console.error("GetFileLink Error:", error); }
  return null;
}

export async function pollUpdates(handleMessage) {
  let offset = 0;
  console.log("Bot MaYo v5.3 Ultimate Ready...");
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
    } catch (e) { await new Promise(r => setTimeout(r, 5000)); }
  }
}

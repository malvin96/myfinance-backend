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

export async function sendDocument(chatId, filePath, caption = "") {
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    form.append('document', fs.createReadStream(filePath));
    await fetch(`${TELEGRAM_API}/sendDocument`, { method: "POST", body: form });
  } catch (error) { console.error("Telegram SendDocument Error:", error); }
}

export async function pollUpdates(handleMessage) {
  let offset = 0;
  console.log("Bot MaYo Cloud Ready...");
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

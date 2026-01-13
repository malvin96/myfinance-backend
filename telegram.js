const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
let offset = 0;

async function api(method, body = {}) {
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) { console.error(`❌ API ${method} Error:`, err.message); return { ok: false }; }
}

export async function pollUpdates(onMessage) {
  // Membersihkan Webhook agar Polling bisa berjalan tanpa Conflict 409
  await api("deleteWebhook", { drop_pending_updates: true });
  console.log("📡 Telegram polling started (Anti-Conflict Mode)");

  while (true) {
    try {
      const data = await api("getUpdates", { offset, timeout: 30 });
      if (data.ok && data.result.length > 0) {
        for (const upd of data.result) {
          offset = upd.update_id + 1;
          if (upd.message && upd.message.text) {
            const reply = await onMessage(upd.message);
            if (reply) await api("sendMessage", { chat_id: upd.message.chat.id, text: reply, parse_mode: "Markdown" });
          }
        }
      } else if (data.error_code === 409) {
        console.log("⚠️ Conflict detected, waiting 5s...");
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) { console.error("❌ Polling error:", err.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
}

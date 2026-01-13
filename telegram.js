const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN tidak ditemukan di ENV");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
let offset = 0;

async function api(method, body = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("❌ Telegram API error:", data);
  }
  return data;
}

export async function pollUpdates(onMessage) {
  console.log("📡 Telegram polling started");

  while (true) {
    try {
      const data = await api("getUpdates", {
        offset,
        timeout: 30,
      });

      if (data.result && data.result.length > 0) {
        for (const upd of data.result) {
          offset = upd.update_id + 1;

          if (upd.message && upd.message.text) {
            const reply = await onMessage(upd.message);

            if (reply) {
              await api("sendMessage", {
                chat_id: upd.message.chat.id,
                text: reply,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Polling error:", err.message);
    }

    // jeda kecil supaya CPU aman di free tier
    await new Promise(r => setTimeout(r, 1000));
  }
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN tidak ada");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
let offset = 0;

async function api(method, body = {}) {
  const r = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function pollUpdates(onMessage) {
  while (true) {
    try {
      const d = await api("getUpdates", { offset, timeout: 30 });
      if (d.result?.length) {
        for (const u of d.result) {
          offset = u.update_id + 1;
          if (u.message?.text) {
            const reply = await onMessage(u.message);
            await api("sendMessage", {
              chat_id: u.message.chat.id,
              text: reply
            });
          }
        }
      }
    } catch (e) {
      console.error("Polling error:", e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

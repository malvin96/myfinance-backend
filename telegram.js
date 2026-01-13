const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN tidak ada");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
let offset = 0;

async function api(method, body = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function pollUpdates(onMessage) {
  while (true) {
    try {
      const data = await api("getUpdates", { offset, timeout: 30 });

      if (data.result?.length) {
        for (const upd of data.result) {
          offset = upd.update_id + 1;
          if (upd.message?.text) {
            const reply = await onMessage(upd.message);
            await api("sendMessage", {
              chat_id: upd.message.chat.id,
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

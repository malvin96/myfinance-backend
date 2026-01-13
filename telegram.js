import fetch from "node-fetch";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(chatId, text) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      }),
    });
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

export async function pollUpdates(handleMessage) {
  let offset = 0;
  while (true) {
    try {
      const response = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`);
      const data = await response.json();
      if (data.result && data.result.length > 0) {
        for (const update of data.result) {
          if (update.message) {
            const reply = await handleMessage(update.message);
            if (reply) await sendMessage(update.message.chat.id, reply);
          }
          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      console.error("Polling error:", error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

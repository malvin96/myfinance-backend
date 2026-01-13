import express from "express";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getRekap } from "./db.js";

const app = express();
app.use(express.json());

// ===== ENV =====
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN tidak ada");
  process.exit(1);
}
const TG_API = `https://api.telegram.org/bot${TOKEN}`;

// ===== INIT DB =====
initDB();

// ===== SEND MESSAGE (FETCH GLOBAL, TANPA DEPENDENCY) =====
async function sendMessage(chatId, text) {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    if (!res.ok) {
      console.error("❌ Telegram send error:", await res.text());
    }
  } catch (e) {
    console.error("❌ Fetch error:", e.message);
  }
}

// ===== TELEGRAM WEBHOOK =====
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // WAJIB cepat

  const msg = req.body?.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  console.log("INCOMING:", text);

  const p = parseInput(text);

  if (p.type === "saldo") {
    return sendMessage(chatId, getSaldo(p.account));
  }

  if (p.type === "rekap") {
    return sendMessage(chatId, getRekap());
  }

  if (p.type === "tx") {
    addTx(p);
    return sendMessage(
      chatId,
      `✔️ TERCATAT
${p.user} | ${p.account}
${p.amount}
${p.category}
Saldo ${p.account}: ${getSaldo(p.account, true)}`
    );
  }

  return sendMessage(chatId, "⚠️ Perintah tidak dikenali");
});

// ===== HEALTH =====
app.get("/", (_, res) => res.send("MY FINANCE LIVE"));

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("MY FINANCE TELEGRAM BOT RUNNING");
});

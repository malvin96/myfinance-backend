import express from "express";
import { parseInput } from "./parser.js";
import { initDB, addTx, getSaldo, getRekap } from "./db.js";

const app = express();
app.use(express.json());

// ====== ENV ======
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN belum ada di ENV");
  process.exit(1);
}
const TG = `https://api.telegram.org/bot${TOKEN}`;

// ====== INIT DB ======
initDB();

// ====== SEND MESSAGE (Telegram wajib explicit) ======
async function sendMessage(chatId, text) {
  const r = await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("❌ sendMessage gagal:", t);
  }
}

// ====== WEBHOOK ======
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // cepat balas ke Telegram

  const msg = req.body?.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const sender = msg.from?.username || "";

  console.log("INCOMING:", text);

  const p = parseInput(text, sender);

  if (p.type === "saldo") {
    const out = getSaldo(p.account);
    return sendMessage(chatId, out);
  }

  if (p.type === "rekap") {
    const out = getRekap();
    return sendMessage(chatId, out);
  }

  if (p.type === "tx") {
    addTx(p);
    const out = `✔️ Tercatat
${p.user} | ${p.account}
${p.amount}
${p.category}
Saldo ${p.account}: ${getSaldo(p.account, true)}`;
    return sendMessage(chatId, out);
  }

  return sendMessage(chatId, "⚠️ Perintah tidak dikenali.");
});

// ====== HEALTH ======
app.get("/", (_, res) => res.send("MY FINANCE LIVE"));

// ====== START ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("MY FINANCE TELEGRAM BOT RUNNING"));

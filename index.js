import express from "express";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { initDB, insertTransaction, getBalance, getRecap } from "./db.js";
import { parseInput } from "./parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

/* =========================
   ENV & TELEGRAM CONFIG
========================= */
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN tidak ditemukan");
  process.exit(1);
}

const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

/* =========================
   INIT DATABASE
========================= */
initDB();

/* =========================
   HELPER: SEND MESSAGE
========================= */
async function sendMessage(chatId, text) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    })
  });
}

/* =========================
   TELEGRAM WEBHOOK (WAJIB)
========================= */
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;

    if (!update.message || !update.message.text) {
      return res.sendStatus(200);
    }

    const chatId = update.message.chat.id;
    const from = update.message.from;
    const text = update.message.text.trim();

    console.log("INCOMING:", text);

    const result = parseInput(text, from);

    // === SALDO ===
    if (result.type === "saldo") {
      const saldo = getBalance(result);
      await sendMessage(chatId, saldo);
      return res.sendStatus(200);
    }

    // === REKAP ===
    if (result.type === "rekap") {
      const recap = getRecap(result);
      await sendMessage(chatId, recap);
      return res.sendStatus(200);
    }

    // === TRANSAKSI ===
    if (result.type === "transaksi") {
      insertTransaction(result);
      const saldo = getBalance({ account: result.account });
      const out =
`OK
User: ${result.user}
Akun: ${result.account}
Jumlah: ${result.amount}
Kategori: ${result.category}
Saldo ${result.account}: ${saldo}`;
      await sendMessage(chatId, out);
      return res.sendStatus(200);
    }

    // === DEFAULT ===
    await sendMessage(chatId, "⚠️ Perintah tidak dikenali.");
    res.sendStatus(200);

  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.sendStatus(200);
  }
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("MY FINANCE BACKEND RUNNING");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("MY FINANCE TELEGRAM BOT RUNNING");
});

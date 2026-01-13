const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const { parseInput } = require("./parser");
const { insertTransaction, getLedger } = require("./ledger");
const {
  getBalanceByAccount,
  getTotalBalance,
  getRecapByUser,
  getFullRecap
} = require("./aggregate");
const { exportCSV } = require("./export");

const app = express();
app.use(express.json());
app.use(bodyParser.json());

// === CONFIG ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// === SEND MESSAGE TO TELEGRAM ===
async function sendTelegramMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
}

// === WEBHOOK ===
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Telegram HARUS cepat dibalas

  const msg = req.body.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text;
  const sender = msg.from?.username || "";

  const parsed = parseInput({ text, sender });

  // ERROR
  if (parsed.type === "error") {
    return sendTelegramMessage(chatId, `⚠️ ${parsed.message}`);
  }

  // COMMAND
  if (parsed.type === "command") {
    if (parsed.command === "saldo") {
      const balances = getBalanceByAccount();
      const total = getTotalBalance();

      let out = "SALDO\n";
      balances.forEach(b => out += `${b.account}\t${b.balance}\n`);
      out += `TOTAL\t${total}`;

      return sendTelegramMessage(chatId, out);
    }

    if (parsed.command === "rekap") {
      const recap = getFullRecap();
      const byUser = getRecapByUser();

      let out = "REKAP\n";
      out += `INCOME\t${recap.income || 0}\n`;
      out += `EXPENSE\t${recap.expense || 0}\n`;
      out += `NET\t${recap.net || 0}\n\n`;
      byUser.forEach(r => out += `${r.user}\t${r.total}\n`);

      return sendTelegramMessage(chatId, out);
    }
  }

  // TRANSACTION
  if (parsed.type === "transaction") {
    insertTransaction(parsed);

    const balance =
      getBalanceByAccount().find(b => b.account === parsed.account)?.balance || 0;

    const out =
`✔️ Tercatat
${parsed.account}\t${parsed.amount}
${parsed.category}
Saldo ${parsed.account}: ${balance}`;

    return sendTelegramMessage(chatId, out);
  }

  sendTelegramMessage(chatId, "⚠️ Perintah tidak dikenali.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("MY FINANCE TELEGRAM BOT RUNNING");
});

import TelegramBot from "node-telegram-bot-api";
import { getUser, addIncome, addExpense, getTransactions } from "./db.js";

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = msg.text || "";

  if (text.startsWith("/saldo")) {
    const user = getUser(userId);
    return bot.sendMessage(chatId, `💰 Saldo kamu: Rp ${user.balance.toLocaleString()}`);
  }

  if (text.startsWith("/masuk")) {
    const [, amount, category = "Umum", ...note] = text.split(" ");
    addIncome(userId, Number(amount), category, note.join(" "));
    return bot.sendMessage(chatId, "✅ Pendapatan tercatat");
  }

  if (text.startsWith("/keluar")) {
    const [, amount, category = "Umum", ...note] = text.split(" ");
    addExpense(userId, Number(amount), category, note.join(" "));
    return bot.sendMessage(chatId, "❌ Pengeluaran tercatat");
  }

  if (text.startsWith("/history")) {
    const tx = getTransactions(userId);
    if (!tx.length) return bot.sendMessage(chatId, "Belum ada transaksi.");
    const out = tx.map(t =>
      `${t.type === "income" ? "➕" : "➖"} Rp${t.amount.toLocaleString()} - ${t.category}`
    ).join("\n");
    return bot.sendMessage(chatId, out);
  }
});

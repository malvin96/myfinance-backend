// index.js
// MY FINANCE — ENTRY POINT (WEBHOOK TELEGRAM)

const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

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

/**
 * === WAJIB: JSON PARSER (NATIVE EXPRESS) ===
 * Ini memastikan payload Telegram terbaca di Render
 */
app.use(express.json());
app.use(bodyParser.json());

/**
 * === LOG MASUK (BUKTI REQUEST) ===
 */
app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});

/**
 * Normalize payload dari Telegram / testing manual
 */
function normalizePayload(req) {
  if (req.body && req.body.message) {
    return {
      text: req.body.message.text || "",
      sender: req.body.message.from?.username || ""
    };
  }

  if (req.body && req.body.text) {
    return {
      text: req.body.text,
      sender: req.body.sender || ""
    };
  }

  return { text: "", sender: "" };
}

function formatText(lines) {
  return lines.join("\n");
}

/**
 * === WEBHOOK TELEGRAM ===
 */
app.post("/webhook", (req, res) => {
  console.log("WEBHOOK BODY:", JSON.stringify(req.body));

  try {
    const { text, sender } = normalizePayload(req);
    if (!text) {
      return res.json({ text: "⚠️ Pesan kosong / tidak dikenali." });
    }

    const parsed = parseInput({ text, sender });

    if (parsed.type === "error") {
      return res.json({ text: `⚠️ ${parsed.message}` });
    }

    if (parsed.type === "command") {
      const cmd = parsed.command;

      if (cmd === "saldo") {
        const balances = getBalanceByAccount();
        const total = getTotalBalance();

        const lines = ["SALDO"];
        balances.forEach(b => lines.push(`${b.account}\t${b.balance}`));
        lines.push(`TOTAL\t${total}`);

        return res.json({ text: formatText(lines) });
      }

      if (cmd === "rekap") {
        const recap = getFullRecap();
        const byUser = getRecapByUser();

        const lines = ["REKAP"];
        lines.push(`INCOME\t${recap.income || 0}`);
        lines.push(`EXPENSE\t${recap.expense || 0}`);
        lines.push(`NET\t${recap.net || 0}`);
        lines.push("");
        byUser.forEach(r => lines.push(`${r.user}\t${r.total}`));

        return res.json({ text: formatText(lines) });
      }

      if (cmd === "history") {
        const rows = getLedger({ limit: 20 });
        const lines = ["HISTORY"];
        rows.forEach(tx =>
          lines.push(`${tx.timestamp}\t${tx.account}\t${tx.amount}\t${tx.category}`)
        );
        return res.json({ text: formatText(lines) });
      }

      if (cmd === "export") {
        const csv = exportCSV({});
        const date = new Date().toISOString().slice(0, 10);
        const filename = `myfinance-export-${date}.csv`;
        const dir = path.join(__dirname, "export");

        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(path.join(dir, filename), csv);

        return res.json({
          text: `EXPORT SIAP\n${filename}`
        });
      }
    }

    if (parsed.type === "transaction") {
      insertTransaction(parsed);
      const balance =
        getBalanceByAccount().find(b => b.account === parsed.account)?.balance || 0;

      const lines = [
        "✔️ Tercatat",
        `${parsed.account}\t${parsed.amount}`,
        parsed.category,
        `Saldo ${parsed.account}: ${balance}`
      ];

      return res.json({ text: formatText(lines) });
    }

    return res.json({ text: "⚠️ Perintah tidak dikenali." });
  } catch (err) {
    console.error("ERROR:", err);
    return res.json({
      text: "⚠️ Sistem MY Finance bermasalah. Tidak ada transaksi dicatat."
    });
  }
});

/**
 * === START SERVER ===
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MY Finance running on port ${PORT}`);
});

// index.js
// MY FINANCE ENTRY POINT — SINGLE SOURCE OF TRUTH

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
app.use(bodyParser.json());

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

app.post("/webhook", (req, res) => {
  try {
    const { text, sender } = normalizePayload(req);
    if (!text) return res.json({ text: "⚠️ Input kosong." });

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

        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, csv);

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
    return res.json({
      text:
        "⚠️ Sistem MY Finance sedang bermasalah. Tidak ada transaksi yang dicatat."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MY Finance running on port ${PORT}`));

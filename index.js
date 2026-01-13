const express = require("express");
const bodyParser = require("body-parser");

const { parseInput } = require("./parser");
const {
  insertTransaction,
  getLedger
} = require("./ledger");
const {
  getBalanceByAccount,
  getTotalBalance,
  getRecapByUser,
  getRecapByAccount,
  getRecapByCategory,
  getFullRecap
} = require("./aggregate");
const { exportCSV } = require("./export");

const app = express();
app.use(bodyParser.json());

/**
 * Normalize incoming payload from:
 * - Botpress
 * - Telegram webhook
 */
function normalizePayload(req) {
  // Telegram
  if (req.body && req.body.message) {
    return {
      text: req.body.message.text || "",
      sender: req.body.message.from?.username || ""
    };
  }

  // Botpress (common pattern)
  if (req.body && req.body.text) {
    return {
      text: req.body.text,
      sender: req.body.sender || ""
    };
  }

  return { text: "", sender: "" };
}

/**
 * Format outputs (LOCKED STYLE)
 */
function formatText(lines) {
  return lines.join("\n");
}

/**
 * MAIN WEBHOOK
 */
app.post("/webhook", (req, res) => {
  try {
    const { text, sender } = normalizePayload(req);

    if (!text) {
      return res.json({ text: "⚠️ Input kosong." });
    }

    const parsed = parseInput({ text, sender });

    // ===== ERROR =====
    if (parsed.type === "error") {
      return res.json({ text: `⚠️ ${parsed.message}` });
    }

    // ===== COMMANDS =====
    if (parsed.type === "command") {
      const cmd = parsed.command;

      // SALDO
      if (cmd === "saldo") {
        const balances = getBalanceByAccount();
        const total = getTotalBalance();

        const lines = ["SALDO"];
        balances.forEach(b => {
          lines.push(`${b.account}\t${b.balance}`);
        });
        lines.push(`TOTAL\t${total}`);

        return res.json({ text: formatText(lines) });
      }

      // REKAP
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

      // HISTORY
      if (cmd === "history") {
        const rows = getLedger({ limit: 20 });

        const lines = ["HISTORY"];
        rows.forEach(tx => {
          lines.push(
            `${tx.timestamp}\t${tx.account}\t${tx.amount}\t${tx.category}`
          );
        });

        return res.json({ text: formatText(lines) });
      }

      // EXPORT
      if (cmd === "export") {
        const csv = exportCSV({});
        return res.json({
          text: "EXPORT SIAP",
          file: csv
        });
      }
    }

    // ===== TRANSACTION =====
    if (parsed.type === "transaction") {
      insertTransaction(parsed);

      const balance = getBalanceByAccount().find(
        b => b.account === parsed.account
      )?.balance || 0;

      const lines = [
        "✔️ Tercatat",
        `${parsed.account}\t${parsed.amount}`,
        parsed.category,
        `Saldo ${parsed.account}: ${balance}`
      ];

      return res.json({ text: formatText(lines) });
    }

    // ===== FALLBACK =====
    return res.json({
      text: "⚠️ Perintah tidak dikenali."
    });
  } catch (err) {
    // FAIL SAFE: DO NOT WRITE ANYTHING HERE
    return res.json({
      text:
        "⚠️ Sistem MY Finance sedang bermasalah. Tidak ada transaksi yang dicatat."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MY Finance running on port ${PORT}`);
});

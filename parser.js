const ACCOUNTS = ["cash", "bca", "ovo", "gopay", "shopeepay"];
const COMMANDS = ["saldo", "rekap", "history", "export"];

function parseInput({ text = "", sender = "" }) {
  const original = text;
  const lower = text.toLowerCase();

  // =====================
  // 1. HARD GUARD
  // =====================
  const forbidden = ["set saldo", "edit", "hapus"];
  for (const word of forbidden) {
    if (lower.includes(word)) {
      return {
        type: "error",
        message: "Perintah tidak diizinkan. Gunakan koreksi transaksi."
      };
    }
  }

  // =====================
  // 2. COMMAND DETECTION
  // =====================
  for (const cmd of COMMANDS) {
    if (lower.startsWith(cmd)) {
      return {
        type: "command",
        command: cmd,
        raw: original
      };
    }
  }

  // =====================
  // 3. USER RESOLUTION (POLISHED)
  // =====================
  let user = null;

  // token eksplisit: " m ", "(m)", "[m]"
  if (/(^|\s|\()m(\s|\)|$)/.test(lower)) user = "M";
  if (/(^|\s|\()y(\s|\)|$)/.test(lower)) user = "Y";

  if (!user) {
    if (sender.toLowerCase().includes("malvin")) user = "M";
    else if (sender.toLowerCase().includes("yovita")) user = "Y";
  }

  if (!user) user = "M"; // default aman

  // =====================
  // 4. ACCOUNT RESOLUTION
  // =====================
  let account = null;
  for (const acc of ACCOUNTS) {
    if (lower.includes(acc)) {
      account = acc.toUpperCase();
      break;
    }
  }

  if (!account) {
    return {
      type: "error",
      message: "Akun tidak dikenali. Gunakan: Cash, BCA, OVO, GoPay, ShopeePay."
    };
  }

  // =====================
  // 5. AMOUNT RESOLUTION
  // =====================
  let amount = null;
  const rbMatch = lower.match(/(\d+)\s*rb/);
  const jtMatch = lower.match(/(\d+)\s*jt/);
  const numMatch = lower.match(/(\d{3,})/);

  if (jtMatch) amount = parseInt(jtMatch[1], 10) * 1_000_000;
  else if (rbMatch) amount = parseInt(rbMatch[1], 10) * 1_000;
  else if (numMatch) amount = parseInt(numMatch[1], 10);

  if (!amount) {
    return {
      type: "error",
      message: "Nominal tidak ditemukan."
    };
  }

  // =====================
  // 6. CATEGORY & TYPE
  // =====================
  let category = "lainnya";
  let type = "expense";

  if (lower.includes("gaji") || lower.includes("saldo awal")) {
    type = "income";
    category = "income";
  }

  if (lower.includes("makan")) category = "makan";
  if (lower.includes("transport")) category = "transport";
  if (lower.includes("bayi")) category = "bayi";

  if (type === "expense") amount = -Math.abs(amount);

  // =====================
  // 7. TAG RESOLUTION
  // =====================
  const tags = (lower.match(/#\w+/g) || []).join(",");

  // =====================
  // 8. NOTE CLEANING
  // =====================
  const note = original
    .replace(/#\w+/g, "")
    .replace(/(^|\s|\()m(\s|\)|$)/gi, "")
    .replace(/(^|\s|\()y(\s|\)|$)/gi, "")
    .trim();

  return {
    type: "transaction",
    user,
    account,
    amount,
    category,
    note,
    tags
  };
}

module.exports = { parseInput };

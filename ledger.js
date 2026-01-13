const db = require("./db");

/**
 * Insert new transaction (ONLY WAY to change ledger)
 */
function insertTransaction({
  timestamp = new Date().toISOString(),
  user,
  account,
  amount,
  category,
  note = "",
  tags = "",
  reference_tx_id = null
}) {
  if (!user || !account || !amount || !category) {
    throw new Error("INVALID_TRANSACTION_DATA");
  }

  if (amount === 0) {
    throw new Error("AMOUNT_CANNOT_BE_ZERO");
  }

  const stmt = `
    INSERT INTO ledger
    (timestamp, user, account, amount, category, note, tags, reference_tx_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.prepare(stmt).run(
    timestamp,
    user,
    account,
    amount,
    category,
    note,
    tags,
    reference_tx_id
  );
}

/**
 * Get raw ledger (for history & audit)
 */
function getLedger({ limit = 100, offset = 0 } = {}) {
  return db
    .prepare(
      `
      SELECT *
      FROM ledger
      ORDER BY timestamp DESC, id DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);
}

/**
 * Get balance by account
 */
function getBalanceByAccount(account) {
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount), 0) as balance
      FROM ledger
      WHERE account = ?
    `
    )
    .get(account);

  return row.balance;
}

/**
 * Get total balance
 */
function getTotalBalance() {
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount), 0) as balance
      FROM ledger
    `
    )
    .get();

  return row.balance;
}

module.exports = {
  insertTransaction,
  getLedger,
  getBalanceByAccount,
  getTotalBalance
};

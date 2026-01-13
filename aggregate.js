const db = require("./db");

/**
 * Helper: build date filter SQL
 */
function buildDateFilter({ start, end }) {
  let sql = "";
  const params = [];

  if (start) {
    sql += " AND timestamp >= ? ";
    params.push(start);
  }

  if (end) {
    sql += " AND timestamp <= ? ";
    params.push(end);
  }

  return { sql, params };
}

/**
 * Get balance per account
 */
function getBalanceByAccount() {
  return db
    .prepare(
      `
      SELECT account, COALESCE(SUM(amount), 0) as balance
      FROM ledger
      GROUP BY account
    `
    )
    .all();
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

/**
 * Get recap by user (M / Y)
 */
function getRecapByUser({ start, end } = {}) {
  const { sql, params } = buildDateFilter({ start, end });

  return db
    .prepare(
      `
      SELECT user, COALESCE(SUM(a

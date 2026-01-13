const db = require("./db");

/**
 * Helper: build date filter SQL
 */
function buildDateFilter({ start, end } = {}) {
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
 * Balance per account
 */
function getBalanceByAccount() {
  return db
    .prepare(
      `
      SELECT account, COALESCE(SUM(amount), 0) AS balance
      FROM ledger
      GROUP BY account
    `
    )
    .all();
}

/**
 * Total balance
 */
function getTotalBalance() {
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount), 0) AS balance
      FROM ledger
    `
    )
    .get();

  return row.balance;
}

/**
 * Recap by user (M / Y)
 */
function getRecapByUser({ start, end } = {}) {
  const { sql, params } = buildDateFilter({ start, end });

  return db
    .prepare(
      `
      SELECT user, COALESCE(SUM(amount), 0) AS total
      FROM ledger
      WHERE 1=1
      ${sql}
      GROUP BY user
    `
    )
    .all(...params);
}

/**
 * Recap by category
 */
function getRecapByCategory({ start, end } = {}) {
  const { sql, params } = buildDateFilter({ start, end });

  return db
    .prepare(
      `
      SELECT category, COALESCE(SUM(amount), 0) AS total
      FROM ledger
      WHERE 1=1
      ${sql}
      GROUP BY category
    `
    )
    .all(...params);
}

/**
 * Recap by account
 */
function getRecapByAccount({ start, end } = {}) {
  const { sql, params } = buildDateFilter({ start, end });

  return db
    .prepare(
      `
      SELECT account, COALESCE(SUM(amount), 0) AS total
      FROM ledger
      WHERE 1=1
      ${sql}
      GROUP BY account
    `
    )
    .all(...params);
}

/**
 * Full recap (income / expense / net)
 */
function getFullRecap({ start, end } = {}) {
  const { sql, params } = buildDateFilter({ start, end });

  return db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS expense,
        COALESCE(SUM(amount), 0) AS net
      FROM ledger
      WHERE 1=1
      ${sql}
    `
    )
    .get(...params);
}

module.exports = {
  getBalanceByAccount,
  getTotalBalance,
  getRecapByUser,
  getRecapByCategory,
  getRecapByAccount,
  getFullRecap
};

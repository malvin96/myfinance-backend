// snapshot.js
// MY FINANCE SNAPSHOT — READ ONLY CACHE
// ⚠️ NOT A SOURCE OF TRUTH
// ⚠️ DO NOT USE TO RESTORE OR MODIFY LEDGER

const db = require("./db");

/**
 * Create snapshot for observation / debugging only
 * Snapshot is NOT used by aggregate or ledger
 */
function createSnapshot() {
  const rows = db
    .prepare(
      `
      SELECT account, COALESCE(SUM(amount), 0) as balance
      FROM ledger
      GROUP BY account
    `
    )
    .all();

  const snapshot = {
    timestamp: new Date().toISOString(),
    balances: rows
  };

  return snapshot;
}

/**
 * Get snapshot (computed on demand)
 * No persistence to DB
 */
function getSnapshot() {
  return createSnapshot();
}

module.exports = {
  createSnapshot,
  getSnapshot
};

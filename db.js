const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// === DB PATH ===
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "myfinance.db");

// === ENSURE DATA DIR EXISTS (CRITICAL) ===
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// === INIT DB ===
const db = new Database(DB_PATH);

// === SAFETY PRAGMAS ===
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// === INIT TABLE (IDEMPOTENT) ===
db.prepare(`
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    user TEXT NOT NULL,
    account TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL,
    note TEXT,
    tags TEXT,
    reference_tx_id INTEGER
  )
`).run();

module.exports = db;

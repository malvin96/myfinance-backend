const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const { exportCSV } = require("./export");

// ===== CONFIG =====
const DB_PATH = path.join(__dirname, "data", "myfinance.db");
const BACKUP_DIR = path.join(__dirname, "backup");
const EXPORT_DIR = path.join(__dirname, "export");

// Ensure dirs exist
[BACKUP_DIR, EXPORT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Backup SQLite DB (daily)
 */
cron.schedule("0 2 * * *", () => {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const dest = path.join(BACKUP_DIR, `myfinance-${date}.db`);
    fs.copyFileSync(DB_PATH, dest);
    console.log(`[BACKUP] Database backed up: ${dest}`);
  } catch (err) {
    console.error("[BACKUP ERROR]", err.message);
  }
});

/**
 * Monthly export (CSV)
 */
cron.schedule("0 3 1 * *", () => {
  try {
    const date = new Date().toISOString().slice(0, 7);
    const csv = exportCSV({});
    const dest = path.join(EXPORT_DIR, `myfinance-${date}.csv`);
    fs.writeFileSync(dest, csv);
    console.log(`[EXPORT] Monthly export created: ${dest}`);
  } catch (err) {
    console.error("[EXPORT ERROR]", err.message);
  }
});

module.exports = {};

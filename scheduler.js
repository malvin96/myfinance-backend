import fs from "fs";
import path from "path";
import cron from "node-cron";
import { exportText } from "./export.js"; // Sesuaikan dengan fungsi yang ada

const __dirname = process.cwd(); // ES Modules tidak punya __dirname bawaan
const DB_PATH = path.join(__dirname, "data", "myfinance.db");
const BACKUP_DIR = path.join(__dirname, "backup");
const EXPORT_DIR = path.join(__dirname, "export");

// Pastikan folder ada
[BACKUP_DIR, EXPORT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Backup Harian
cron.schedule("0 2 * * *", () => {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const dest = path.join(BACKUP_DIR, `myfinance-${date}.db`);
    fs.copyFileSync(DB_PATH, dest);
    console.log(`[BACKUP] Berhasil: ${dest}`);
  } catch (err) {
    console.error("[BACKUP ERROR]", err.message);
  }
});

import fs from "fs";
import path from "path";
import cron from "node-cron";
import { exportText } from "./export.js";

const DB_PATH = path.join(process.cwd(), "data", "myfinance.db");
const BACKUP_DIR = path.join(process.cwd(), "backup");
const EXPORT_DIR = path.join(process.cwd(), "export");

[BACKUP_DIR, EXPORT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Backup harian jam 02:00
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

// Export bulanan jam 03:00 tanggal 1
cron.schedule("0 3 1 * *", () => {
  try {
    const date = new Date().toISOString().slice(0, 7);
    const textData = exportText();
    const dest = path.join(EXPORT_DIR, `myfinance-${date}.txt`);
    fs.writeFileSync(dest, textData);
    console.log(`[EXPORT] Monthly export created: ${dest}`);
  } catch (err) {
    console.error("[EXPORT ERROR]", err.message);
  }
});

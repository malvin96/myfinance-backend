import cron from "node-cron"
import { exportAll } from "./ledger.js"
import fetch from "node-fetch"

const URL = process.env.TELEGRAM_BACKUP_URL

cron.schedule("59 23 * * 0", async ()=>{
  if(!URL) return
  await fetch(URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ text: exportAll() })
  })
})

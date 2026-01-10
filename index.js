const express = require("express")
const sqlite3 = require("sqlite3").verbose()
const bodyParser = require("body-parser")

const app = express()
app.use(bodyParser.json())
const db = new sqlite3.Database("./myfinance.db")

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT,
      user TEXT,
      type TEXT,
      category TEXT,
      sub TEXT,
      needType TEXT,
      account TEXT,
      asset TEXT,
      nominal INTEGER
    )
  `)
})

app.post("/add", (req,res)=>{
  const t=req.body
  db.run(
    `INSERT INTO transactions
     (time,user,type,category,sub,needType,account,asset,nominal)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [t.time,t.user,t.type,t.category,t.sub,t.needType,t.account,t.asset,t.nominal],
    ()=>res.json({status:"ok"})
  )
})

app.get("/export",(req,res)=>{
  db.all(`SELECT * FROM transactions ORDER BY time`,(e,rows)=>res.json(rows))
})

app.get("/rekap/full",(req,res)=>{
  db.all(`
    SELECT user,
      SUM(CASE WHEN type='income' THEN nominal ELSE 0 END) as income,
      SUM(CASE WHEN type='expense' THEN nominal ELSE 0 END) as expense,
      SUM(CASE WHEN category='Investasi' THEN nominal ELSE 0 END) as investasi
    FROM transactions
    GROUP BY user
  `,(e,rows)=>res.json(rows))
})

app.get("/networth",(req,res)=>{
  db.all(`
    SELECT 
      SUM(CASE WHEN category='Investasi' THEN nominal ELSE 0 END) +
      SUM(CASE WHEN type='income' THEN nominal ELSE -nominal END)
      as networth
    FROM transactions
  `,(e,rows)=>res.json(rows[0]))
})

const PORT=process.env.PORT||3000
app.listen(PORT,()=>console.log("MY Finance backend running"))

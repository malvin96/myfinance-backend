const express = require("express")
const sqlite3 = require("sqlite3").verbose()
const bodyParser = require("body-parser")

const app = express()
app.use(bodyParser.json())

const db = new sqlite3.Database("./myfinance.db")

// ================= CREATE TABLE =================
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
      nominal INTEGER
    )
  `)
})

// ================= ADD TRANSACTION =================
app.post("/add", (req, res) => {
  const t = req.body
  db.run(
    `INSERT INTO transactions
     (time,user,type,category,sub,needType,account,nominal)
     VALUES (?,?,?,?,?,?,?,?)`,
    [t.time, t.user, t.type, t.category, t.sub, t.needType, t.account, t.nominal],
    () => res.json({ status: "ok" })
  )
})

// ================= EXPORT ALL =================
app.get("/export", (req, res) => {
  db.all(`SELECT * FROM transactions ORDER BY time`, (err, rows) => {
    res.json(rows)
  })
})

// ================= REKAP =================
app.get("/rekap", (req, res) => {
  db.all(`
    SELECT 
      user,
      SUM(CASE WHEN type='income' THEN nominal ELSE 0 END) as income,
      SUM(CASE WHEN type='expense' THEN nominal ELSE 0 END) as expense,
      SUM(CASE WHEN type='income' THEN nominal ELSE -nominal END) as net
    FROM transactions
    GROUP BY user
  `, (err, rows) => {
    res.json(rows)
  })
})

// ================= REKAP PER KATEGORI =================
app.get("/rekap/kategori", (req, res) => {
  db.all(`
    SELECT 
      category,
      SUM(nominal) as total
    FROM transactions
    WHERE type='expense'
    GROUP BY category
    ORDER BY total DESC
  `, (err, rows) => {
    res.json(rows)
  })
})

// ================= REKAP NEED VS WANT =================
app.get("/rekap/needwant", (req, res) => {
  db.all(`
    SELECT 
      needType,
      SUM(nominal) as total
    FROM transactions
    WHERE type='expense'
    GROUP BY needType
  `, (err, rows) => {
    res.json(rows)
  })
})

// ================= CC CHECK =================
app.get("/cc/today", (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  db.all(
    `SELECT * FROM transactions 
     WHERE category='CC' AND time LIKE ?`,
    [today + "%"],
    (err, rows) => {
      res.json(rows)
    }
  )
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("MY Finance backend running on port " + PORT))

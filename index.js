const express = require('express')
const sqlite3 = require('sqlite3').verbose()
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())

const db = new sqlite3.Database('./myfinance.db')

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

app.post('/add', (req, res) => {
  const t = req.body
  db.run(
    `INSERT INTO transactions (time,user,type,category,sub,needType,account,nominal)
     VALUES (?,?,?,?,?,?,?,?)`,
    [t.time, t.user, t.type, t.category, t.sub, t.needType, t.account, t.nominal],
    () => res.json({ status: 'ok' })
  )
})

app.get('/export', (req, res) => {
  db.all(`SELECT * FROM transactions ORDER BY time`, (err, rows) => {
    res.json(rows)
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log('MY Finance backend running on ' + PORT))

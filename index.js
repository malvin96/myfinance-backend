const express = require("express")
const sqlite3 = require("sqlite3").verbose()
const bodyParser = require("body-parser")

const app = express()
app.use(bodyParser.json())

const db = new sqlite3.Database("./myfinance.db")

// ===== INIT =====
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

// ===== ADD =====
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

// ===== EXPORT =====
app.get("/export",(req,res)=>{
  db.all(`SELECT * FROM transactions ORDER BY time`,(e,rows)=>res.json(rows))
})

// ===== REKAP PER USER =====
app.get("/rekap",(req,res)=>{
  db.all(`
    SELECT user,
      SUM(CASE WHEN type='income' THEN nominal ELSE 0 END) as income,
      SUM(CASE WHEN type='expense' THEN nominal ELSE 0 END) as expense,
      SUM(CASE WHEN category='Investasi' THEN nominal ELSE 0 END) as investasi,
      SUM(
        CASE 
          WHEN category='Investasi' THEN nominal
          WHEN type='income' THEN nominal
          ELSE -nominal
        END
      ) as net
    FROM transactions
    GROUP BY user
  `,(e,rows)=>res.json(rows))
})

// ===== REKAP KATEGORI =====
app.get("/rekap/kategori",(req,res)=>{
  db.all(`
    SELECT category, SUM(nominal) as total
    FROM transactions
    WHERE type='expense'
    GROUP BY category
    ORDER BY total DESC
  `,(e,rows)=>res.json(rows))
})

// ===== NEED VS WANT =====
app.get("/rekap/needwant",(req,res)=>{
  db.all(`
    SELECT needType, SUM(nominal) as total
    FROM transactions
    WHERE type='expense'
    GROUP BY needType
  `,(e,rows)=>res.json(rows))
})

// ===== DASHBOARD =====
app.get("/dashboard",(req,res)=>{
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>MY Finance Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{font-family:sans-serif;padding:20px;background:#f4f4f4}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
canvas{background:white;padding:10px;border-radius:10px}
select{padding:8px;margin-bottom:20px}
</style>
</head>
<body>

<h2>MY Finance Dashboard</h2>

<select id="range">
<option value="all">All Time</option>
<option value="day">Hari Ini</option>
<option value="week">7 Hari</option>
<option value="month">30 Hari</option>
<option value="year">365 Hari</option>
</select>

<div class="grid">
<canvas id="networth"></canvas>
<canvas id="users"></canvas>
<canvas id="accounts"></canvas>
<canvas id="category"></canvas>
<canvas id="needwant"></canvas>
</div>

<script>
async function load(range){
const data=await fetch('/export').then(r=>r.json())
const now=new Date()
const rows=data.filter(t=>{
const d=new Date(t.time)
if(range==='day') return (now-d)<86400000
if(range==='week') return (now-d)<604800000
if(range==='month') return (now-d)<2592000000
if(range==='year') return (now-d)<31536000000
return true
})

// NET WORTH
let net={}
rows.forEach(t=>{
net[t.user]||=0
if(t.category==='Investasi') net[t.user]+=t.nominal
else if(t.type==='income') net[t.user]+=t.nominal
else if(t.type==='expense') net[t.user]-=t.nominal
})
new Chart(networth,{type:'bar',data:{labels:Object.keys(net),datasets:[{label:'Net Worth',data:Object.values(net)}]}})

// USER
let u={}
rows.forEach(t=>{if(t.type==='expense'){u[t.user]||=0;u[t.user]+=t.nominal}})
new Chart(users,{type:'bar',data:{labels:Object.keys(u),datasets:[{label:'Expense',data:Object.values(u)}]}})

// ACCOUNT
let a={}
rows.forEach(t=>{if(t.type==='expense'){a[t.account]||=0;a[t.account]+=t.nominal}})
new Chart(accounts,{type:'bar',data:{labels:Object.keys(a),datasets:[{label:'Expense',data:Object.values(a)}]}})

// CATEGORY
let c={}
rows.forEach(t=>{if(t.type==='expense'){c[t.category]||=0;c[t.category]+=t.nominal}})
new Chart(category,{type:'bar',data:{labels:Object.keys(c),datasets:[{label:'Expense',data:Object.values(c)}]}})

// NEED WANT
let n={}
rows.forEach(t=>{if(t.type==='expense'){n[t.needType]||=0;n[t.needType]+=t.nominal}})
new Chart(needwant,{type:'pie',data:{labels:Object.keys(n),datasets:[{data:Object.values(n)}]}})
}

load("all")
range.onchange=()=>load(range.value)
</script>
</body>
</html>
`)
})

const PORT=process.env.PORT||3000
app.listen(PORT,()=>console.log("MY Finance backend running"))

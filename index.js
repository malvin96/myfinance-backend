import express from "express"
import cors from "cors"
import { handle } from "./parser.js"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/", (req,res)=>res.send("MY FINANCE BACKEND OK"))

app.post("/chat",(req,res)=>{
  try{
    const { text } = req.body
    const r = handle(text)
    res.json(r)
  }catch(e){
    res.json({ reply:"❌ Server error" })
  }
})

app.listen(3000)

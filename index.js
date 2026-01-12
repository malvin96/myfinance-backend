import express from "express"
import cors from "cors"
import { handleMessage } from "./parser.js"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
  res.send("MY FINANCE BACKEND RUNNING")
})

app.post("/process", async (req, res) => {
  try {
    const { telegram_id, text } = req.body
    const reply = await handleMessage(telegram_id, text)
    res.json({ reply })
  } catch (err) {
    console.error(err)
    res.json({ reply: "❌ Server error" })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("Server running on", PORT))

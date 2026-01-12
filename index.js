import express from "express"
import cors from "cors"
import { handleMessage } from "./parser.js"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
  res.send("MY FINANCE BACKEND OK")
})

app.post("/webhook", async (req, res) => {
  try {
    const { chat_id, text } = req.body
    if (!chat_id || !text) return res.json({ reply: "Format salah." })
    const reply = await handleMessage(chat_id, text)
    res.json({ reply })
  } catch (e) {
    console.error(e)
    res.json({ reply: "⚠️ Server error. Coba lagi." })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("RUNNING", PORT))

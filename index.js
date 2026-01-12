import express from "express"
import cors from "cors"
import { handleMessage } from "./parser.js"

const app = express()
app.use(cors())
app.use(express.json())

// health check
app.get("/", (req, res) => {
  res.send("MY FINANCE BACKEND OK")
})

// MAIN ENDPOINT (dipanggil Botpress)
app.post("/webhook", async (req, res) => {
  try {
    const { chat_id, text } = req.body

    if (!chat_id || !text) {
      return res.json({ reply: "❌ Format request salah." })
    }

    const reply = await handleMessage(chat_id, text)
    res.json({ reply })
  } catch (err) {
    console.error("BACKEND ERROR:", err)
    res.json({
      reply: "⚠️ Server MY Finance error. Data kamu aman. Coba ulangi sebentar lagi."
    })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log("MY FINANCE BACKEND RUNNING on", PORT)
})

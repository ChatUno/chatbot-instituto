const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// API Routes (must come before static files)
app.use('/api/screenshot', require('./routes/screenshot'))
app.use('/api/extract', require('./routes/extract'))
app.use('/api/chunk', require('./routes/chunk'))
app.use('/api/export', require('./routes/export'))

// Static files (serve after API routes)
app.use(express.static(path.join(__dirname, '../client')))

// Serve client fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index-new.html'))
})

// Start server
app.listen(PORT, () => {
  console.log(`V5.1 Visual RAG corriendo en puerto ${PORT}`)
})

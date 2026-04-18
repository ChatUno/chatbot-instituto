const express = require('express')
const { chunkText } = require('../services/groqService')
const router = express.Router()

router.post('/', async (req, res) => {
  try {
    // Validaciones
    if (!req.body.text) {
      return res.status(400).json({
        success: false,
        error: "El campo text es obligatorio"
      })
    }

    if (typeof req.body.text !== 'string' || req.body.text.trim().split(/\s+/).length < 10) {
      return res.status(400).json({
        success: false,
        error: "El texto es demasiado corto para chunking"
      })
    }

    if (!req.body.sourceUrl) {
      return res.status(400).json({
        success: false,
        error: "El campo sourceUrl es obligatorio"
      })
    }

    // Lógica principal
    const chunks = await chunkText(req.body.text, req.body.sourceUrl)

    // Éxito
    res.status(200).json({
      success: true,
      data: {
        chunks: chunks,
        totalChunks: chunks.length,
        sourceUrl: req.body.sourceUrl
      }
    })

  } catch (error) {
    // Error
    res.status(502).json({
      success: false,
      error: error.message || "Error en el procesamiento del texto",
      detail: error.stack || "Error técnico no especificado"
    })
  }
})

module.exports = router

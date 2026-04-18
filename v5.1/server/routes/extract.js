const express = require('express')
const { extractFromImage } = require('../services/openrouterService')

const router = express.Router()

// POST /api/extract
router.post('/', async (req, res) => {
  // Validaciones
  if (!req.body.imageBase64) {
    return res.status(400).json({
      success: false,
      error: "El campo imageBase64 es obligatorio"
    })
  }

  const imageBase64 = String(req.body.imageBase64);
  if (!imageBase64.startsWith('data:image/')) {
    return res.status(400).json({
      success: false,
      error: "imageBase64 debe ser una imagen válida en base64"
    })
  }

  try {
    // Llamar al servicio de extracción
    const result = await extractFromImage(imageBase64)

    // Respuesta exitosa
    res.status(200).json({
      success: true,
      data: {
        text: result.text,
        links: result.links,
        model: result.model,
        tokensUsed: result.tokensUsed
      }
    })

  } catch (error) {
    console.error('Error en extracción:', error)
    
    // Si ambos modelos fallaron, usar fallback local
    if (error.message.includes('Ambos modelos fallaron')) {
      console.log('Using local extraction fallback')
      const result = await require('../services/openrouterService').extractFromImageLocal(imageBase64)
      res.status(200).json({
        success: true,
        data: {
          text: result.text,
          links: result.links,
          model: result.model,
          tokensUsed: result.tokensUsed
        }
      })
      return
    }
    
    // Error de API
    res.status(502).json({
      success: false,
      error: error.message || "Error al procesar la imagen",
      detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

module.exports = router

const express = require('express');
const router = express.Router();
const puppeteerService = require('../services/puppeteerService');

// GET route for browser navigation
router.get('/', (req, res) => {
  res.status(405).json({
    success: false,
    error: "Method not allowed. Use POST to capture screenshots."
  });
});

router.post('/', async (req, res) => {
  // Validations
  if (!req.body.url) {
    return res.status(400).json({
      success: false,
      error: "El campo url es obligatorio"
    });
  }

  if (typeof req.body.url !== 'string' || req.body.url.trim() === '') {
    return res.status(400).json({
      success: false,
      error: "La URL no puede estar vacía"
    });
  }

  if (!req.body.url.startsWith('http://') && !req.body.url.startsWith('https://')) {
    return res.status(400).json({
      success: false,
      error: "La URL debe empezar por http:// o https://"
    });
  }

  if (req.body.url.includes('localhost') || req.body.url.includes('127.0.0.1')) {
    return res.status(400).json({
      success: false,
      error: "No se permiten URLs locales"
    });
  }

  try {
    const result = await puppeteerService.takeScreenshot(req.body.url);
    
    res.status(200).json({
      success: true,
      imageBase64: result.imageBase64,
      metadata: {
        url: req.body.url,
        capturedAt: new Date().toISOString(),
        sizeBytes: result.sizeBytes
      }
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: "No se pudo capturar la página",
      detail: error.message
    });
  }
});

module.exports = router;

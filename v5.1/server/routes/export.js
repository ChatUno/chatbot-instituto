const express = require('express')
const router = express.Router()
const { exportChunks, readChunks, listBackups } = require('../services/storageService')

// POST /api/export - Export approved chunks
router.post('/', (req, res) => {
  try {
    const { chunks } = req.body
    
    // Validations
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de chunks aprobados'
      })
    }
    
    // Validate each chunk format
    for (const chunk of chunks) {
      if (!chunk.text || !chunk.category || typeof chunk.quality_score !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Formato de chunk inválido'
        })
      }
    }
    
    // Export chunks
    const result = exportChunks(chunks)
    
    res.json({
      success: true,
      data: result
    })
    
  } catch (error) {
    console.error('Export error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      detail: 'Error durante la exportación de chunks'
    })
  }
})

// GET /api/export/status - Get current database status
router.get('/status', (req, res) => {
  try {
    const chunks = readChunks()
    let lastModified = null
    
    try {
      const fs = require('fs')
      const path = require('path')
      const CHUNKS_PATH = path.join(__dirname, '../../../data/chunks.json')
      if (fs.existsSync(CHUNKS_PATH)) {
        const stats = fs.statSync(CHUNKS_PATH)
        lastModified = stats.mtime.toISOString()
      }
    } catch (error) {
      console.warn('Warning: Could not get modification time:', error.message)
    }
    
    res.json({
      success: true,
      data: {
        totalChunks: chunks.length,
        lastModified
      }
    })
    
  } catch (error) {
    console.error('Status error:', error)
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de la base de datos',
      detail: error.message
    })
  }
})

// GET /api/export/backups - List available backups
router.get('/backups', (req, res) => {
  try {
    const backups = listBackups()
    
    res.json({
      success: true,
      data: {
        backups
      }
    })
    
  } catch (error) {
    console.error('Backups error:', error)
    res.status(500).json({
      success: false,
      error: 'Error al listar backups',
      detail: error.message
    })
  }
})

module.exports = router

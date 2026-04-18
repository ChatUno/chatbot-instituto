const express = require('express')
const router = express.Router()
const { crawlSite } = require('../services/crawlerService')

let crawlInProgress = false

// POST /api/crawl
router.post('/', async (req, res) => {
  try {
    // Validaciones
    const { url, maxPages, maxDepth, delayMs } = req.body
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: "URL de inicio obligatoria"
      })
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        error: "La URL debe empezar con http:// o https://"
      })
    }
    
    const options = {
      maxPages: maxPages ? Math.min(Math.max(parseInt(maxPages), 1), 20) : 10,
      maxDepth: maxDepth ? Math.min(Math.max(parseInt(maxDepth), 1), 2) : 1,
      delayMs: delayMs ? Math.max(parseInt(delayMs), 1000) : 2000,
      minQualityScore: 40
    }
    
    if (maxPages && (parseInt(maxPages) < 1 || parseInt(maxPages) > 20)) {
      return res.status(400).json({
        success: false,
        error: "maxPages debe estar entre 1 y 20"
      })
    }
    
    // Check if crawl is already in progress
    if (crawlInProgress) {
      return res.status(409).json({
        success: false,
        error: "Ya hay un proceso de crawling en progreso"
      })
    }
    
    // Set crawl in progress
    crawlInProgress = true
    
    console.log(`[Crawl API] Starting crawl for ${url} with options:`, options)
    
    // Set timeout for this request (5 minutes)
    req.setTimeout(5 * 60 * 1000)
    
    // Execute crawl
    const result = await crawlSite(url, options)
    
    // Clear crawl in progress flag
    crawlInProgress = false
    
    console.log(`[Crawl API] Crawl completed successfully`)
    
    res.json({
      success: true,
      data: result
    })
    
  } catch (error) {
    // Clear crawl in progress flag on error
    crawlInProgress = false
    
    console.error('[Crawl API] Error:', error.message)
    
    res.status(500).json({
      success: false,
      error: "Error en el proceso de crawling",
      detail: error.message
    })
  }
})

// GET /api/crawl/status
router.get('/status', (req, res) => {
  res.json({
    crawling: crawlInProgress
  })
})

module.exports = router

const puppeteerService = require('./puppeteerService')
const openrouterService = require('./openrouterService')
const groqService = require('./groqService')

function normalizeUrl(url, baseUrl) {
  try {
    const baseOrigin = new URL(baseUrl).origin
    
    // Si url empieza por http: devolver tal cual
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    
    // Si url empieza por #: devolver null (anchor, ignorar)
    if (url.startsWith('#')) {
      return null
    }
    
    // Si url empieza por mailto: o tel:: devolver null
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) {
      return null
    }
    
    // Si url empieza por /: devolver origin(baseUrl) + url
    if (url.startsWith('/')) {
      return baseOrigin + url
    }
    
    // Si url es relativa: devolver baseUrl + '/' + url
    if (!url.includes('://')) {
      // Remove trailing slash from baseUrl if present
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
      return cleanBaseUrl + '/' + url
    }
    
    return null
  } catch (error) {
    console.error('Error normalizing URL:', error.message)
    return null
  }
}

function isSameDomain(url, baseUrl) {
  try {
    const urlObj = new URL(url)
    const baseUrlObj = new URL(baseUrl)
    return urlObj.hostname === baseUrlObj.hostname
  } catch (error) {
    return false
  }
}

function shouldSkipUrl(url) {
  const skipExtensions = [
    '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.zip', 
    '.doc', '.docx', '.mp4', '.mp3', '.svg', '.ico', 
    '.css', '.js', '.xml', '.json', '.xls', '.xlsx', 
    '.ppt', '.pptx', '.txt', '.rar', '.7z'
  ]
  
  const lowerUrl = url.toLowerCase()
  
  // Skip files with extensions
  for (const ext of skipExtensions) {
    if (lowerUrl.includes(ext)) {
      return true
    }
  }
  
  // Skip special protocols
  if (lowerUrl.startsWith('mailto:') || 
      lowerUrl.startsWith('tel:') || 
      lowerUrl.startsWith('javascript:') ||
      lowerUrl.startsWith('#')) {
    return true
  }
  
  return false
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getLinksFromPage(url) {
  console.log(`[Crawler] Extracting HTML links from ${url}`)
  
  const puppeteer = require('puppeteer')
  let browser = null
  let page = null
  
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding'
      ]
    })

    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 20000
    })
    
    await new Promise(r => setTimeout(r, 1500))
    
    // Extract all href attributes from links
    const htmlLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(href => href.startsWith('http'))
    })
    
    console.log(`[Crawler] Found ${htmlLinks.length} HTML links`)
    
    return htmlLinks
    
  } catch (error) {
    console.error(`[Crawler] Error extracting HTML links from ${url}:`, error.message)
    return []
  } finally {
    try {
      if (page) await page.close()
      if (browser) await browser.close()
    } catch (cleanupError) {
      console.warn('[Crawler] HTML links cleanup error:', cleanupError.message)
    }
  }
}

async function crawlSite(startUrl, options = {}) {
  const defaultOptions = {
    maxPages: 10,
    maxDepth: 1,
    delayMs: 2000,
    minQualityScore: 40
  }
  
  const opts = { ...defaultOptions, ...options }
  
  const visited = new Set()
  const results = []
  const errors = []
  const allChunks = []
  
  console.log(`[Crawler] Starting crawl of ${startUrl} with options:`, opts)
  
  async function processPage(url, depth) {
    // 1. Si visited.has(url): return
    if (visited.has(url)) {
      return
    }
    
    // 2. Si visited.size >= maxPages: return
    if (visited.size >= opts.maxPages) {
      return
    }
    
    // 3. visited.add(url)
    visited.add(url)
    
    // 4. Log: console.log(`Crawling [${visited.size}/${maxPages}]: ${url}`)
    console.log(`[Crawler] Crawling [${visited.size}/${opts.maxPages}]: ${url} (depth: ${depth})`)
    
    try {
      // a. screenshot = await puppeteerService.takeScreenshot(url)
      const screenshot = await puppeteerService.takeScreenshot(url)
      
      // b. extracted = await openrouterService.extractFromImage(screenshot.imageBase64)
      const extracted = await openrouterService.extractFromImage(screenshot.imageBase64)
      
      // c. Get HTML links from the page
      const htmlLinks = await getLinksFromPage(url)
      
      // d. Combine vision links and HTML links, deduplicate
      const visionLinks = extracted.links || []
      const allLinks = [...new Set([...visionLinks, ...htmlLinks])]
      console.log(`[Crawler] Combined links: ${visionLinks.length} vision + ${htmlLinks.length} HTML = ${allLinks.length} total`)
      
      // e. links detectados = allLinks
      const detectedLinks = allLinks
      
      // d. Si extracted.text tiene menos de 20 palabras:
      const wordCount = extracted.text.trim().split(/\s+/).length
      if (wordCount < 20) {
        results.push({
          url,
          status: 'skipped',
          reason: 'Insufficient text content',
          wordCount,
          linksFound: detectedLinks.length
        })
        console.log(`[Crawler] Skipped ${url}: insufficient text (${wordCount} words)`)
        return
      }
      
      // e. chunked = await groqService.chunkText(extracted.text, url)
      const chunked = await groqService.chunkText(extracted.text, url)
      
      // f. Filtrar chunks con quality_score >= minQualityScore
      const filteredChunks = chunked.filter(chunk => chunk.quality_score >= opts.minQualityScore)
      
      // g. allChunks.push(...filteredChunks)
      allChunks.push(...filteredChunks)
      
      // h. results.push(...)
      results.push({
        url,
        status: 'success',
        chunksGenerated: filteredChunks.length,
        linksFound: detectedLinks.length,
        wordCount,
        depth
      })
      
      console.log(`[Crawler] Success ${url}: ${filteredChunks.length} chunks, ${detectedLinks.length} links`)
      
      // i. Si depth < maxDepth:
      if (depth < opts.maxDepth) {
        console.log(`[Crawler] Processing ${detectedLinks.length} links from ${url}`)
        
        for (const link of detectedLinks) {
          const normalized = normalizeUrl(link, startUrl)
          
          if (!normalized) {
            continue // Skip invalid URLs
          }
          
          if (!isSameDomain(normalized, startUrl)) {
            continue // Skip external domains
          }
          
          if (shouldSkipUrl(normalized)) {
            continue // Skip file types and special protocols
          }
          
          if (visited.has(normalized)) {
            continue // Skip already visited
          }
          
          // Wait before processing next page
          await sleep(opts.delayMs)
          
          // Process the page recursively
          await processPage(normalized, depth + 1)
        }
      }
      
    } catch (err) {
      console.error(`[Crawler] Error processing ${url}:`, err.message)
      errors.push({ url, error: err.message })
      results.push({ 
        url, 
        status: 'error',
        error: err.message,
        depth
      })
    }
  }
  
  // EJECUCIÓN:
  await processPage(startUrl, 0)
  
  // DEVOLVER:
  const summary = {
    startUrl,
    pagesVisited: visited.size,
    pagesSuccess: results.filter(r => r.status === 'success').length,
    pagesError: errors.length,
    pagesSkipped: results.filter(r => r.status === 'skipped').length,
    chunksGenerated: allChunks.length,
    results,
    errors,
    chunks: allChunks
  }
  
  console.log(`[Crawler] Crawl completed:`, {
    pagesVisited: summary.pagesVisited,
    pagesSuccess: summary.pagesSuccess,
    pagesError: summary.pagesError,
    pagesSkipped: summary.pagesSkipped,
    chunksGenerated: summary.chunksGenerated
  })
  
  return summary
}

module.exports = { 
  crawlSite,
  normalizeUrl,
  isSameDomain,
  shouldSkipUrl
}

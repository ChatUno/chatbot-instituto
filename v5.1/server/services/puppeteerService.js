const puppeteer = require('puppeteer');

async function takeScreenshot(url) {
  let browser = null;
  let page = null;
  
  try {
    console.log(`[Puppeteer] Starting screenshot for URL: ${url}`);
    
    // Launch configuration with additional stability flags
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
    });

    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 900 });
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    
    // Wait for delayed JS
    await new Promise(r => setTimeout(r, 1500));
    
    // Try to close common popups/cookie banners
    await page.evaluate(() => {
      const selectors = [
        '[id*="cookie"]', '[class*="cookie"]',
        '[id*="consent"]', '[class*="consent"]',
        '[id*="popup"]', '[class*="popup"]',
        '[id*="modal"]', '[class*="gdpr"]'
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel)
          .forEach(el => el.remove());
      });
    }).catch(() => {});
    
    // Take screenshot
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
      encoding: 'binary'
    });
    
    // Convert to base64
    const base64 = Buffer.from(screenshot).toString('base64');
    
    return {
      imageBase64: 'data:image/png;base64,' + base64,
      sizeBytes: Buffer.from(screenshot).length
    };
    
  } catch (error) {
    console.error(`[Puppeteer] Error taking screenshot for ${url}:`, error.message);
    
    // Handle specific error types
    if (error.message.includes('timeout')) {
      throw new Error('La página tardó demasiado en cargar (>20s)');
    } else if (error.message.includes('Navigation timeout')) {
      throw new Error('Timeout en la navegación de la página');
    } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      throw new Error('No se puede resolver el nombre de dominio de la URL');
    } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      throw new Error('Conexión rechazada por el servidor');
    } else if (error.message.includes('net::ERR_SSL_PROTOCOL_ERROR')) {
      throw new Error('Error de protocolo SSL en la URL');
    } else if (error.message.includes('Target closed')) {
      throw new Error('El navegador se cerró inesperadamente');
    } else {
      throw new Error(`Error en captura de pantalla: ${error.message}`);
    }
  } finally {
    // Ensure proper cleanup
    try {
      if (page) {
        await page.close();
      }
      if (browser) {
        await browser.close();
      }
    } catch (cleanupError) {
      console.warn('[Puppeteer] Cleanup error:', cleanupError.message);
    }
  }
}

module.exports = { takeScreenshot };

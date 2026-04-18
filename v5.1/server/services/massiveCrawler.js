const puppeteer = require('puppeteer');
const { URL } = require('url');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

class MassiveCrawler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrency = options.maxConcurrency || 5;
    this.maxDepth = options.maxDepth || 3;
    this.rateLimitDelay = options.rateLimitDelay || 1000;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 5000;
    
    this.browser = null;
    this.crawlingState = {
      visited: new Set(),
      queue: [],
      processing: new Set(),
      failed: new Set(),
      discovered: [],
      stats: {
        totalDiscovered: 0,
        totalProcessed: 0,
        totalFailed: 0,
        startTime: null,
        endTime: null
      }
    };
    this.rateLimiters = new Map();
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.crawlingState.stats.startTime = new Date();
  }

  async crawl(baseUrl) {
    if (!this.browser) await this.initialize();
    
    const domain = new URL(baseUrl).hostname;
    this.crawlingState.queue.push({
      url: baseUrl,
      depth: 0,
      parentUrl: null,
      domain
    });

    this.emit('started', { baseUrl, domain });

    while (this.crawlingState.queue.length > 0 || this.crawlingState.processing.size > 0) {
      await this.processQueue();
      await this.delay(100);
    }

    this.crawlingState.stats.endTime = new Date();
    this.emit('completed', this.crawlingState.stats);
    
    return this.crawlingState;
  }

  async processQueue() {
    while (this.crawlingState.processing.size < this.maxConcurrency && this.crawlingState.queue.length > 0) {
      const pageData = this.crawlingState.queue.shift();
      if (this.crawlingState.visited.has(pageData.url)) continue;

      this.crawlingState.processing.add(pageData.url);
      this.crawlingState.visited.add(pageData.url);

      this.processPage(pageData).catch(error => {
        console.error(`Error processing ${pageData.url}:`, error);
        this.crawlingState.failed.add(pageData.url);
        this.crawlingState.stats.totalFailed++;
      }).finally(() => {
        this.crawlingState.processing.delete(pageData.url);
      });
    }
  }

  async processPage(pageData) {
    await this.rateLimit(pageData.domain);
    
    let attempts = 0;
    while (attempts < this.retryAttempts) {
      try {
        const result = await this.crawlSinglePage(pageData);
        this.crawlingState.stats.totalProcessed++;
        this.crawlingState.discovered.push(result);
        
        if (pageData.depth < this.maxDepth) {
          const links = await this.extractLinks(result.content, pageData.url, pageData.domain, pageData.depth + 1);
          this.crawlingState.queue.push(...links);
        }
        
        this.crawlingState.stats.totalDiscovered = this.crawlingState.visited.size + this.crawlingState.queue.length;
        this.emit('pageProcessed', result);
        return result;
        
      } catch (error) {
        attempts++;
        if (attempts >= this.retryAttempts) throw error;
        await this.delay(this.retryDelay * attempts);
      }
    }
  }

  async crawlSinglePage(pageData) {
    const page = await this.browser.newPage();
    const pageId = crypto.createHash('md5').update(pageData.url).digest('hex');
    
    try {
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      
      const response = await page.goto(pageData.url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      const content = await page.content();
      const title = await page.title();
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: true 
      });

      const result = {
        url: pageData.url,
        title,
        content,
        screenshot,
        pageId,
        depth: pageData.depth,
        parentUrl: pageData.parentUrl,
        domain: pageData.domain,
        timestamp: new Date().toISOString(),
        statusCode: response.status(),
        contentType: response.headers()['content-type'] || 'text/html'
      };

      await this.savePageData(result);
      return result;

    } finally {
      await page.close();
    }
  }

  async extractLinks(html, currentUrl, domain, depth) {
    const page = await this.browser.newPage();
    try {
      await page.setContent(html);
      const links = await page.evaluate((targetDomain) => {
        const linkElements = document.querySelectorAll('a[href]');
        const links = [];
        
        linkElements.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;
          
          try {
            const fullUrl = new URL(href, window.location.href);
            if (fullUrl.hostname === targetDomain) {
              links.push({
                url: fullUrl.href,
                text: link.textContent.trim(),
                depth
              });
            }
          } catch (e) {
            // Invalid URL, skip
          }
        });
        
        return links;
      }, domain);

      return links.filter(link => 
        !this.crawlingState.visited.has(link.url) &&
        !this.crawlingState.queue.some(item => item.url === link.url)
      );

    } finally {
      await page.close();
    }
  }

  async savePageData(pageData) {
    const domain = pageData.domain.replace(/[^a-zA-Z0-9]/g, '_');
    const dataDir = path.join(process.cwd(), 'data', 'crawling', 'sites', domain);
    
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(path.join(dataDir, 'pages', 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(dataDir, 'pages', 'html'), { recursive: true });

    // Save screenshot
    const screenshotPath = path.join(dataDir, 'pages', 'screenshots', `${pageData.pageId}.png`);
    await fs.writeFile(screenshotPath, pageData.screenshot);

    // Save HTML content
    const htmlPath = path.join(dataDir, 'pages', 'html', `${pageData.pageId}.html`);
    await fs.writeFile(htmlPath, pageData.content);

    // Save metadata
    const metadata = {
      url: pageData.url,
      title: pageData.title,
      depth: pageData.depth,
      parentUrl: pageData.parentUrl,
      domain: pageData.domain,
      timestamp: pageData.timestamp,
      statusCode: pageData.statusCode,
      contentType: pageData.contentType,
      pageId: pageData.pageId,
      screenshotPath: `pages/screenshots/${pageData.pageId}.png`,
      htmlPath: `pages/html/${pageData.pageId}.html`
    };

    const metadataPath = path.join(dataDir, 'metadata', `${pageData.pageId}.json`);
    await fs.mkdir(path.join(dataDir, 'metadata'), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async rateLimit(domain) {
    if (!this.rateLimiters.has(domain)) {
      this.rateLimiters.set(domain, 0);
    }

    const lastRequest = this.rateLimiters.get(domain);
    const now = Date.now();
    
    if (now - lastRequest < this.rateLimitDelay) {
      await this.delay(this.rateLimitDelay - (now - lastRequest));
    }
    
    this.rateLimiters.set(domain, Date.now());
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getStats() {
    return {
      ...this.crawlingState.stats,
      queueSize: this.crawlingState.queue.length,
      processingSize: this.crawlingState.processing.size,
      visitedSize: this.crawlingState.visited.size,
      failedSize: this.crawlingState.failed.size
    };
  }
}

module.exports = MassiveCrawler;

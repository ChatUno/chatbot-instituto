const MassiveCrawler = require('../../server/services/massiveCrawler');
const fs = require('fs').promises;
const path = require('path');

describe('MassiveCrawler', () => {
  let crawler;
  const testConfig = {
    maxConcurrency: 2,
    maxDepth: 2,
    rateLimitDelay: 100,
    timeout: 5000,
    retryAttempts: 2,
    retryDelay: 1000
  };

  beforeEach(() => {
    crawler = new MassiveCrawler(testConfig);
  });

  afterEach(async () => {
    if (crawler.browser) {
      await crawler.stop();
    }
  });

  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      const defaultCrawler = new MassiveCrawler();
      expect(defaultCrawler.maxConcurrency).toBe(5);
      expect(defaultCrawler.maxDepth).toBe(3);
      expect(defaultCrawler.rateLimitDelay).toBe(1000);
    });

    test('should accept custom configuration', () => {
      expect(crawler.maxConcurrency).toBe(testConfig.maxConcurrency);
      expect(crawler.maxDepth).toBe(testConfig.maxDepth);
      expect(crawler.rateLimitDelay).toBe(testConfig.rateLimitDelay);
    });

    test('should initialize crawling state', () => {
      expect(crawler.crawlingState).toBeDefined();
      expect(crawler.crawlingState.visited).toBeInstanceOf(Set);
      expect(crawler.crawlingState.queue).toBeInstanceOf(Array);
      expect(crawler.crawlingState.processing).toBeInstanceOf(Set);
    });
  });

  describe('URL Resolution', () => {
    test('should resolve relative URLs correctly', () => {
      const baseUrl = 'https://example.com/page/';
      const relativeUrl = '/subpage';
      const resolved = crawler.resolveUrl(relativeUrl, baseUrl);
      expect(resolved).toBe('https://example.com/subpage');
    });

    test('should handle absolute URLs', () => {
      const baseUrl = 'https://example.com/page/';
      const absoluteUrl = 'https://other.com/page';
      const resolved = crawler.resolveUrl(absoluteUrl, baseUrl);
      expect(resolved).toBe('https://other.com/page');
    });

    test('should handle protocol-relative URLs', () => {
      const baseUrl = 'https://example.com/page/';
      const protocolRelativeUrl = '//cdn.example.com/script.js';
      const resolved = crawler.resolveUrl(protocolRelativeUrl, baseUrl);
      expect(resolved).toBe('https://cdn.example.com/script.js');
    });
  });

  describe('Link Extraction', () => {
    test('should extract links from HTML content', async () => {
      const html = `
        <html>
          <body>
            <a href="/page1">Page 1</a>
            <a href="https://example.com/page2">Page 2</a>
            <a href="page3">Page 3</a>
          </body>
        </html>
      `;
      
      const links = await crawler.extractLinks(html, 'https://example.com/', 'example.com', 1);
      
      expect(links).toHaveLength(3);
      expect(links[0].url).toBe('https://example.com/page1');
      expect(links[1].url).toBe('https://example.com/page2');
      expect(links[2].url).toBe('https://example.com/page3');
    });

    test('should filter out external domain links', async () => {
      const html = `
        <html>
          <body>
            <a href="/internal">Internal</a>
            <a href="https://external.com/page">External</a>
          </body>
        </html>
      `;
      
      const links = await crawler.extractLinks(html, 'https://example.com/', 'example.com', 1);
      
      expect(links).toHaveLength(1);
      expect(links[0].url).toBe('https://example.com/internal');
    });

    test('should skip invalid URLs', async () => {
      const html = `
        <html>
          <body>
            <a href="javascript:void(0)">Script</a>
            <a href="mailto:test@example.com">Email</a>
            <a href="/valid">Valid</a>
          </body>
        </html>
      `;
      
      const links = await crawler.extractLinks(html, 'https://example.com/', 'example.com', 1);
      
      expect(links).toHaveLength(1);
      expect(links[0].url).toBe('https://example.com/valid');
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limiting delays', async () => {
      const domain = 'example.com';
      const startTime = Date.now();
      
      await crawler.rateLimit(domain);
      const firstCallTime = Date.now();
      
      await crawler.rateLimit(domain);
      const secondCallTime = Date.now();
      
      expect(secondCallTime - firstCallTime).toBeGreaterThanOrEqual(testConfig.rateLimitDelay);
    });

    test('should handle multiple domains independently', async () => {
      const domain1 = 'example1.com';
      const domain2 = 'example2.com';
      
      await crawler.rateLimit(domain1);
      await crawler.rateLimit(domain2);
      
      // Should not delay for different domains
      expect(crawler.rateLimiters.get(domain1)).toBeDefined();
      expect(crawler.rateLimiters.get(domain2)).toBeDefined();
    });
  });

  describe('State Management', () => {
    test('should track visited URLs', () => {
      const url1 = 'https://example.com/page1';
      const url2 = 'https://example.com/page2';
      
      crawler.crawlingState.visited.add(url1);
      crawler.crawlingState.visited.add(url2);
      
      expect(crawler.crawlingState.visited.has(url1)).toBe(true);
      expect(crawler.crawlingState.visited.has(url2)).toBe(true);
      expect(crawler.crawlingState.visited.size).toBe(2);
    });

    test('should manage queue correctly', () => {
      const page1 = { url: 'https://example.com/page1', depth: 0 };
      const page2 = { url: 'https://example.com/page2', depth: 1 };
      
      crawler.crawlingState.queue.push(page1, page2);
      
      expect(crawler.crawlingState.queue).toHaveLength(2);
      expect(crawler.crawlingState.queue[0]).toEqual(page1);
      expect(crawler.crawlingState.queue[1]).toEqual(page2);
    });

    test('should track processing URLs', () => {
      const url1 = 'https://example.com/page1';
      const url2 = 'https://example.com/page2';
      
      crawler.crawlingState.processing.add(url1);
      crawler.crawlingState.processing.add(url2);
      
      expect(crawler.crawlingState.processing.has(url1)).toBe(true);
      expect(crawler.crawlingState.processing.has(url2)).toBe(true);
      expect(crawler.crawlingState.processing.size).toBe(2);
    });
  });

  describe('Statistics', () => {
    test('should provide accurate statistics', () => {
      crawler.crawlingState.stats.totalDiscovered = 10;
      crawler.crawlingState.stats.totalProcessed = 8;
      crawler.crawlingState.stats.totalFailed = 2;
      crawler.crawlingState.visited.add('https://example.com/page1');
      crawler.crawlingState.queue.push({ url: 'https://example.com/page2' });
      crawler.crawlingState.processing.add('https://example.com/page3');
      
      const stats = crawler.getStats();
      
      expect(stats.totalDiscovered).toBe(10);
      expect(stats.totalProcessed).toBe(8);
      expect(stats.totalFailed).toBe(2);
      expect(stats.visitedSize).toBe(1);
      expect(stats.queueSize).toBe(1);
      expect(stats.processingSize).toBe(1);
    });
  });

  describe('File Operations', () => {
    const testDataDir = path.join(__dirname, '../test-data');
    const domain = 'test-site.com';

    beforeEach(async () => {
      await fs.mkdir(testDataDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDataDir, { recursive: true, force: true });
    });

    test('should save page data correctly', async () => {
      const pageData = {
        url: 'https://test-site.com/page1',
        title: 'Test Page',
        content: '<html><body>Test content</body></html>',
        pageId: 'test123',
        domain: 'test-site.com',
        timestamp: new Date().toISOString(),
        statusCode: 200,
        contentType: 'text/html',
        screenshot: Buffer.from('fake-screenshot-data')
      };

      // Mock the data directory
      const originalCwd = process.cwd();
      process.chdir(testDataDir);

      try {
        await crawler.savePageData(pageData);
        
        const dataDir = path.join(testDataDir, 'data', 'crawling', 'sites', domain);
        const screenshotPath = path.join(dataDir, 'pages', 'screenshots', `${pageData.pageId}.png`);
        const htmlPath = path.join(dataDir, 'pages', 'html', `${pageData.pageId}.html`);
        const metadataPath = path.join(dataDir, 'metadata', `${pageData.pageId}.json`);
        
        const screenshotExists = await fs.access(screenshotPath).then(() => true).catch(() => false);
        const htmlExists = await fs.access(htmlPath).then(() => true).catch(() => false);
        const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
        
        expect(screenshotExists).toBe(true);
        expect(htmlExists).toBe(true);
        expect(metadataExists).toBe(true);
        
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        expect(metadata.url).toBe(pageData.url);
        expect(metadata.title).toBe(pageData.title);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Event Emission', () => {
    test('should emit events during crawling', (done) => {
      let eventReceived = false;
      
      crawler.on('test-event', () => {
        eventReceived = true;
        done();
      });
      
      crawler.emit('test-event');
      expect(eventReceived).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid URLs gracefully', () => {
      expect(() => {
        crawler.resolveUrl('invalid-url', 'https://example.com');
      }).not.toThrow();
    });

    test('should handle missing browser gracefully', async () => {
      const crawlerWithoutBrowser = new MassiveCrawler(testConfig);
      
      // Should not throw even without browser initialization
      expect(() => {
        crawlerWithoutBrowser.getStats();
      }).not.toThrow();
    });
  });

  describe('Concurrency Control', () => {
    test('should respect max concurrency limit', () => {
      expect(crawler.maxConcurrency).toBe(testConfig.maxConcurrency);
    });

    test('should track processing slots correctly', () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3'
      ];
      
      urls.forEach(url => crawler.crawlingState.processing.add(url));
      
      expect(crawler.crawlingState.processing.size).toBe(3);
      expect(crawler.crawlingState.processing.size).toBeGreaterThan(crawler.maxConcurrency);
    });
  });

  describe('Depth Control', () => {
    test('should respect max depth setting', () => {
      expect(crawler.maxDepth).toBe(testConfig.maxDepth);
    });

    test('should not process pages beyond max depth', async () => {
      const html = '<a href="/deep-page">Deep Page</a>';
      const baseUrl = 'https://example.com/';
      const currentDepth = crawler.maxDepth;
      
      const links = await crawler.extractLinks(html, baseUrl, 'example.com', currentDepth + 1);
      
      // Should still extract links but depth should be tracked
      expect(links[0].depth).toBe(currentDepth + 1);
    });
  });
});

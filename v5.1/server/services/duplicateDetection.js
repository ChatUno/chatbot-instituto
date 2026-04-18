const crypto = require('crypto');
const EventEmitter = require('events');

class DuplicateDetection extends EventEmitter {
  constructor(options = {}) {
    super();
    this.contentHashes = new Map();
    this.urlHashes = new Map();
    this.titleHashes = new Map();
    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.maxCacheSize = options.maxCacheSize || 100000;
    this.enableContentHashing = options.enableContentHashing !== false;
    this.enableUrlNormalization = options.enableUrlNormalization !== false;
    this.enableTitleMatching = options.enableTitleMatching !== false;
    
    this.stats = {
      totalChecked: 0,
      duplicatesFound: 0,
      contentDuplicates: 0,
      urlDuplicates: 0,
      titleDuplicates: 0,
      cacheHits: 0
    };
  }

  async checkDuplicate(pageData) {
    this.stats.totalChecked++;
    
    const results = {
      isDuplicate: false,
      duplicateType: null,
      originalUrl: null,
      similarity: 0,
      hashMatches: []
    };
    
    // Check URL duplicates
    if (this.enableUrlNormalization) {
      const urlResult = this.checkUrlDuplicate(pageData.url);
      if (urlResult.isDuplicate) {
        results.isDuplicate = true;
        results.duplicateType = results.duplicateType ? 'multiple' : 'url';
        results.originalUrl = urlResult.originalUrl;
        results.hashMatches.push({ type: 'url', hash: urlResult.hash });
        this.stats.urlDuplicates++;
      }
    }
    
    // Check title duplicates
    if (this.enableTitleMatching && pageData.title) {
      const titleResult = this.checkTitleDuplicate(pageData.title);
      if (titleResult.isDuplicate) {
        results.isDuplicate = true;
        results.duplicateType = results.duplicateType ? 'multiple' : 'title';
        if (!results.originalUrl) results.originalUrl = titleResult.originalUrl;
        results.hashMatches.push({ type: 'title', hash: titleResult.hash });
        this.stats.titleDuplicates++;
      }
    }
    
    // Check content duplicates
    if (this.enableContentHashing && pageData.content) {
      const contentResult = this.checkContentDuplicate(pageData.content);
      if (contentResult.isDuplicate) {
        results.isDuplicate = true;
        results.duplicateType = results.duplicateType ? 'multiple' : 'content';
        if (!results.originalUrl) results.originalUrl = contentResult.originalUrl;
        results.similarity = contentResult.similarity;
        results.hashMatches.push({ type: 'content', hash: contentResult.hash });
        this.stats.contentDuplicates++;
      }
    }
    
    if (results.isDuplicate) {
      this.stats.duplicatesFound++;
      this.emit('duplicateFound', { pageData, results });
    } else {
      // Store in cache if not duplicate
      this.storePageData(pageData);
      this.emit('uniquePage', { pageData });
    }
    
    return results;
  }

  checkUrlDuplicate(url) {
    const normalizedUrl = this.normalizeUrl(url);
    const urlHash = this.createHash(normalizedUrl);
    
    if (this.urlHashes.has(urlHash)) {
      this.stats.cacheHits++;
      return {
        isDuplicate: true,
        type: 'url',
        hash: urlHash,
        originalUrl: this.urlHashes.get(urlHash)
      };
    }
    
    return { isDuplicate: false, hash: urlHash };
  }

  checkTitleDuplicate(title) {
    const normalizedTitle = this.normalizeText(title);
    const titleHash = this.createHash(normalizedTitle);
    
    if (this.titleHashes.has(titleHash)) {
      this.stats.cacheHits++;
      return {
        isDuplicate: true,
        type: 'title',
        hash: titleHash,
        originalUrl: this.titleHashes.get(titleHash)
      };
    }
    
    return { isDuplicate: false, hash: titleHash };
  }

  checkContentDuplicate(content) {
    // Multiple content hashing strategies
    const strategies = [
      this.createFullContentHash.bind(this),
      this.createSampledContentHash.bind(this),
      this.createStructureBasedHash.bind(this)
    ];
    
    for (const strategy of strategies) {
      const contentHash = strategy(content);
      
      if (this.contentHashes.has(contentHash)) {
        const original = this.contentHashes.get(contentHash);
        const similarity = this.calculateContentSimilarity(content, original.content);
        
        if (similarity >= this.similarityThreshold) {
          this.stats.cacheHits++;
          return {
            isDuplicate: true,
            type: 'content',
            hash: contentHash,
            originalUrl: original.url,
            similarity
          };
        }
      }
    }
    
    return { isDuplicate: false, hash: null };
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Remove fragments
      urlObj.hash = '';
      
      // Remove common tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', '_ga', '_gid'];
      const searchParams = new URLSearchParams(urlObj.search);
      
      for (const param of paramsToRemove) {
        searchParams.delete(param);
      }
      
      urlObj.search = searchParams.toString();
      
      // Normalize protocol to https
      urlObj.protocol = 'https:';
      
      // Remove www prefix
      if (urlObj.hostname.startsWith('www.')) {
        urlObj.hostname = urlObj.hostname.substring(4);
      }
      
      // Normalize trailing slashes
      const path = urlObj.pathname;
      if (path !== '/' && path.endsWith('/')) {
        urlObj.pathname = path.slice(0, -1);
      }
      
      return urlObj.toString();
      
    } catch (error) {
      return url.toLowerCase().trim();
    }
  }

  normalizeText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[^\w\s]/g, '')        // Remove special characters
      .replace(/\d+/g, '')             // Remove numbers
      .trim();
  }

  createHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  createFullContentHash(content) {
    const cleanContent = this.cleanContent(content);
    return this.createHash(cleanContent);
  }

  createSampledContentHash(content) {
    const cleanContent = this.cleanContent(content);
    const samples = this.sampleContent(cleanContent, 10);
    return this.createHash(samples.join(''));
  }

  createStructureBasedHash(content) {
    // Extract structural elements
    const structure = this.extractContentStructure(content);
    return this.createHash(JSON.stringify(structure));
  }

  cleanContent(content) {
    if (!content) return '';
    
    return content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')     // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')       // Remove styles
      .replace(/<[^>]*>/g, '')                            // Remove HTML tags
      .replace(/\s+/g, ' ')                               // Normalize whitespace
      .replace(/[\r\n\t]/g, ' ')                          // Remove line breaks and tabs
      .trim();
  }

  sampleContent(content, sampleCount) {
    const words = content.split(/\s+/);
    const samples = [];
    const step = Math.floor(words.length / sampleCount);
    
    for (let i = 0; i < sampleCount; i++) {
      const index = i * step;
      if (index < words.length) {
        samples.push(words.slice(index, index + 10).join(' ')); // 10-word samples
      }
    }
    
    return samples;
  }

  extractContentStructure(content) {
    const structure = {
      headings: [],
      paragraphs: 0,
      links: 0,
      images: 0,
      lists: 0,
      tables: 0
    };
    
    // Extract heading structure
    const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      structure.headings.push(this.normalizeText(match[1]));
    }
    
    // Count structural elements
    structure.paragraphs = (content.match(/<p[^>]*>/gi) || []).length;
    structure.links = (content.match(/<a[^>]*>/gi) || []).length;
    structure.images = (content.match(/<img[^>]*>/gi) || []).length;
    structure.lists = (content.match(/<[ou]l[^>]*>/gi) || []).length;
    structure.tables = (content.match(/<table[^>]*>/gi) || []).length;
    
    return structure;
  }

  calculateContentSimilarity(content1, content2) {
    const clean1 = this.cleanContent(content1);
    const clean2 = this.cleanContent(content2);
    
    // Jaccard similarity on word sets
    const words1 = new Set(clean1.toLowerCase().split(/\s+/));
    const words2 = new Set(clean2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Additional similarity metrics
    const lengthSimilarity = 1 - Math.abs(clean1.length - clean2.length) / Math.max(clean1.length, clean2.length);
    const headingSimilarity = this.calculateHeadingSimilarity(content1, content2);
    
    // Weighted average
    return (jaccardSimilarity * 0.5) + (lengthSimilarity * 0.3) + (headingSimilarity * 0.2);
  }

  calculateHeadingSimilarity(content1, content2) {
    const structure1 = this.extractContentStructure(content1);
    const structure2 = this.extractContentStructure(content2);
    
    const headings1 = new Set(structure1.headings);
    const headings2 = new Set(structure2.headings);
    
    if (headings1.size === 0 && headings2.size === 0) return 1;
    if (headings1.size === 0 || headings2.size === 0) return 0;
    
    const intersection = new Set([...headings1].filter(heading => headings2.has(heading)));
    const union = new Set([...headings1, ...headings2]);
    
    return intersection.size / union.size;
  }

  storePageData(pageData) {
    // Check cache size and cleanup if necessary
    if (this.contentHashes.size >= this.maxCacheSize) {
      this.cleanupCache();
    }
    
    // Store URL hash
    if (this.enableUrlNormalization) {
      const normalizedUrl = this.normalizeUrl(pageData.url);
      const urlHash = this.createHash(normalizedUrl);
      this.urlHashes.set(urlHash, pageData.url);
    }
    
    // Store title hash
    if (this.enableTitleMatching && pageData.title) {
      const normalizedTitle = this.normalizeText(pageData.title);
      const titleHash = this.createHash(normalizedTitle);
      this.titleHashes.set(titleHash, pageData.url);
    }
    
    // Store content hash
    if (this.enableContentHashing && pageData.content) {
      const contentHash = this.createFullContentHash(pageData.content);
      this.contentHashes.set(contentHash, {
        url: pageData.url,
        content: pageData.content,
        timestamp: Date.now()
      });
    }
  }

  cleanupCache() {
    // Remove oldest entries to maintain cache size
    const entriesToRemove = this.contentHashes.size - Math.floor(this.maxCacheSize * 0.8);
    
    if (entriesToRemove > 0) {
      const sortedEntries = Array.from(this.contentHashes.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < entriesToRemove; i++) {
        this.contentHashes.delete(sortedEntries[i][0]);
      }
      
      this.emit('cacheCleanup', { removed: entriesToRemove });
    }
  }

  findSimilarPages(content, threshold = null) {
    const similarityThreshold = threshold || this.similarityThreshold;
    const similarPages = [];
    
    for (const [hash, storedData] of this.contentHashes) {
      const similarity = this.calculateContentSimilarity(content, storedData.content);
      
      if (similarity >= similarityThreshold) {
        similarPages.push({
          url: storedData.url,
          similarity,
          hash
        });
      }
    }
    
    return similarPages.sort((a, b) => b.similarity - a.similarity);
  }

  getDuplicateGroups() {
    const groups = new Map();
    
    // Group by content hash
    for (const [hash, data] of this.contentHashes) {
      if (!groups.has(hash)) {
        groups.set(hash, []);
      }
      groups.get(hash).push(data.url);
    }
    
    // Return only groups with duplicates
    return Array.from(groups.entries())
      .filter(([hash, urls]) => urls.length > 1)
      .map(([hash, urls]) => ({ hash, urls, count: urls.length }));
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: {
        content: this.contentHashes.size,
        urls: this.urlHashes.size,
        titles: this.titleHashes.size
      },
      duplicateRate: this.stats.totalChecked > 0 
        ? Math.round((this.stats.duplicatesFound / this.stats.totalChecked) * 100 * 100) / 100
        : 0
    };
  }

  clearCache() {
    this.contentHashes.clear();
    this.urlHashes.clear();
    this.titleHashes.clear();
    
    this.stats = {
      totalChecked: 0,
      duplicatesFound: 0,
      contentDuplicates: 0,
      urlDuplicates: 0,
      titleDuplicates: 0,
      cacheHits: 0
    };
    
    this.emit('cacheCleared');
  }

  updateConfig(newOptions) {
    Object.assign(this, newOptions);
    this.emit('configUpdated', newOptions);
  }
}

module.exports = DuplicateDetection;

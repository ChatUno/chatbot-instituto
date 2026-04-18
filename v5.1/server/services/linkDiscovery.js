const { URL } = require('url');
const crypto = require('crypto');

class LinkDiscovery {
  constructor(options = {}) {
    this.maxLinksPerPage = options.maxLinksPerPage || 200;
    this.excludePatterns = options.excludePatterns || [
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz)$/i,
      /\/api\//i,
      /\/admin\//i,
      /\/login/i,
      /\/logout/i,
      /\/register/i,
      /\/cart/i,
      /\/checkout/i,
      /\/user\//i,
      /\/profile\//i,
      /\/settings\//i,
      /javascript:/i,
      /mailto:/i,
      /tel:/i,
      /sms:/i,
      /ftp:/i,
      /#.*$/i
    ];
    
    this.includePatterns = options.includePatterns || [
      /\.html?$/i,
      /\.php$/i,
      /\.asp$/i,
      /\.jsp$/i,
      /\.cfm$/i,
      /\.(\/|\/index\.(html?|php|asp|jsp|cfm))?$/
    ];

    this.domainWhitelist = new Set();
    this.domainBlacklist = new Set();
    this.discoveredLinks = new Map();
    this.linkHashes = new Set();
  }

  setDomainWhitelist(domains) {
    this.domainWhitelist = new Set(Array.isArray(domains) ? domains : [domains]);
  }

  setDomainBlacklist(domains) {
    this.domainBlacklist = new Set(Array.isArray(domains) ? domains : [domains]);
  }

  async discoverLinks(html, baseUrl, currentDepth = 0, maxDepth = 3) {
    if (currentDepth >= maxDepth) return [];

    const baseDomain = new URL(baseUrl).hostname;
    const links = await this.extractLinksFromHTML(html, baseUrl, baseDomain);
    
    const filteredLinks = this.filterLinks(links, baseDomain);
    const uniqueLinks = this.deduplicateLinks(filteredLinks);
    
    // Store discovered links for tracking
    for (const link of uniqueLinks) {
      this.discoveredLinks.set(link.url, {
        ...link,
        discoveredAt: new Date().toISOString(),
        depth: currentDepth + 1
      });
    }

    return uniqueLinks;
  }

  async extractLinksFromHTML(html, baseUrl, targetDomain) {
    // Create a simple DOM parser without external dependencies
    const links = [];
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2] ? match[2].replace(/<[^>]*>/g, '').trim() : '';
      
      try {
        const absoluteUrl = this.resolveUrl(href, baseUrl);
        if (absoluteUrl && this.isValidUrl(absoluteUrl, targetDomain)) {
          links.push({
            url: absoluteUrl,
            text: text || '',
            depth: 0
          });
        }
      } catch (error) {
        // Invalid URL, skip
      }
    }

    // Also extract from sitemap references
    const sitemapLinks = this.extractSitemapLinks(html, baseUrl);
    links.push(...sitemapLinks);

    return links;
  }

  extractSitemapLinks(html, baseUrl) {
    const links = [];
    const sitemapPatterns = [
      /<loc>(.*?)<\/loc>/gi,
      /url:\s*["'](.*?)["']/gi,
      /"url":\s*["'](.*?)["']/gi
    ];

    for (const pattern of sitemapPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1];
        try {
          const absoluteUrl = this.resolveUrl(url, baseUrl);
          if (absoluteUrl) {
            links.push({
              url: absoluteUrl,
              text: '',
              depth: 0
            });
          }
        } catch (error) {
          // Invalid URL, skip
        }
      }
    }

    return links;
  }

  resolveUrl(href, baseUrl) {
    if (!href || href.trim() === '') return null;

    // Skip javascript, mailto, tel, etc.
    if (/^(javascript|mailto|tel|sms|ftp):/i.test(href)) return null;

    try {
      return new URL(href, baseUrl).href;
    } catch (error) {
      return null;
    }
  }

  isValidUrl(url, targetDomain) {
    try {
      const parsedUrl = new URL(url);
      
      // Check domain
      if (parsedUrl.hostname !== targetDomain) return false;
      
      // Check protocol
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;
      
      // Check blacklist
      if (this.domainBlacklist.has(parsedUrl.hostname)) return false;
      
      // Check whitelist if it exists
      if (this.domainWhitelist.size > 0 && !this.domainWhitelist.has(parsedUrl.hostname)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  filterLinks(links, targetDomain) {
    return links.filter(link => {
      const url = link.url;
      
      // Check exclude patterns
      for (const pattern of this.excludePatterns) {
        if (pattern.test(url)) return false;
      }

      // Check include patterns
      if (this.includePatterns.length > 0) {
        let matchesInclude = false;
        for (const pattern of this.includePatterns) {
          if (pattern.test(url)) {
            matchesInclude = true;
            break;
          }
        }
        if (!matchesInclude) return false;
      }

      // Additional filtering
      if (this.isLikelyBinaryFile(url)) return false;
      if (this.isLikelyApiEndpoint(url)) return false;
      if (this.isLikelyAuthenticationPage(url)) return false;

      return true;
    });
  }

  deduplicateLinks(links) {
    const uniqueLinks = [];
    const seenUrls = new Set();

    for (const link of links) {
      // Normalize URL for deduplication
      const normalizedUrl = this.normalizeUrl(link.url);
      const urlHash = crypto.createHash('md5').update(normalizedUrl).digest('hex');

      if (!this.linkHashes.has(urlHash) && !seenUrls.has(normalizedUrl)) {
        this.linkHashes.add(urlHash);
        seenUrls.add(normalizedUrl);
        uniqueLinks.push({
          ...link,
          normalizedUrl,
          hash: urlHash
        });
      }
    }

    return uniqueLinks;
  }

  normalizeUrl(url) {
    try {
      const parsedUrl = new URL(url);
      
      // Remove fragments
      parsedUrl.hash = '';
      
      // Remove common tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
      const searchParams = new URLSearchParams(parsedUrl.search);
      
      for (const param of paramsToRemove) {
        searchParams.delete(param);
      }
      
      parsedUrl.search = searchParams.toString();
      
      // Normalize trailing slashes
      const path = parsedUrl.pathname;
      if (path !== '/' && path.endsWith('/')) {
        parsedUrl.pathname = path.slice(0, -1);
      }
      
      return parsedUrl.toString();
    } catch (error) {
      return url;
    }
  }

  isLikelyBinaryFile(url) {
    const binaryExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.tar', '.gz', '.7z', '.exe', '.dmg',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico',
      '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flv',
      '.ttf', '.otf', '.woff', '.woff2', '.eot'
    ];
    
    const urlLower = url.toLowerCase();
    return binaryExtensions.some(ext => urlLower.includes(ext));
  }

  isLikelyApiEndpoint(url) {
    const apiPatterns = [
      /\/api\//i,
      /\/v\d+\//i,
      /\.json$/i,
      /\.xml$/i,
      /\?format=/i,
      /\/rest\//i,
      /\/graphql/i
    ];
    
    return apiPatterns.some(pattern => pattern.test(url));
  }

  isLikelyAuthenticationPage(url) {
    const authPatterns = [
      /\/login/i,
      /\/logout/i,
      /\/signin/i,
      /\/signout/i,
      /\/register/i,
      /\/signup/i,
      /\/auth/i,
      /\/oauth/i,
      /\/sso/i,
      /\/forgot/i,
      /\/reset/i
    ];
    
    return authPatterns.some(pattern => pattern.test(url));
  }

  categorizeLinks(links) {
    const categories = {
      homepage: [],
      navigation: [],
      content: [],
      documents: [],
      media: [],
      forms: [],
      other: []
    };

    for (const link of links) {
      const url = link.url.toLowerCase();
      const text = link.text.toLowerCase();
      
      if (url === '/' || url.endsWith('/index.html') || url.endsWith('/index.php')) {
        categories.homepage.push(link);
      } else if (this.isNavigationLink(url, text)) {
        categories.navigation.push(link);
      } else if (this.isDocumentLink(url)) {
        categories.documents.push(link);
      } else if (this.isMediaLink(url)) {
        categories.media.push(link);
      } else if (this.isFormLink(url, text)) {
        categories.forms.push(link);
      } else {
        categories.content.push(link);
      }
    }

    return categories;
  }

  isNavigationLink(url, text) {
    const navKeywords = ['home', 'about', 'contact', 'menu', 'nav', 'header', 'footer'];
    return navKeywords.some(keyword => 
      url.includes(keyword) || text.includes(keyword)
    );
  }

  isDocumentLink(url) {
    const docPatterns = [
      /\/docs\//i,
      /\/documents\//i,
      /\/files\//i,
      /\/downloads\//i,
      /\/uploads\//i
    ];
    
    return docPatterns.some(pattern => pattern.test(url));
  }

  isMediaLink(url) {
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.mp3', '.pdf'];
    const urlLower = url.toLowerCase();
    return mediaExtensions.some(ext => urlLower.includes(ext));
  }

  isFormLink(url, text) {
    const formKeywords = ['contact', 'submit', 'apply', 'register', 'signup', 'form'];
    return formKeywords.some(keyword => 
      url.includes(keyword) || text.includes(keyword)
    );
  }

  getDiscoveryStats() {
    const categories = this.categorizeLinks(Array.from(this.discoveredLinks.values()));
    
    return {
      totalDiscovered: this.discoveredLinks.size,
      totalUnique: this.linkHashes.size,
      categories: {
        homepage: categories.homepage.length,
        navigation: categories.navigation.length,
        content: categories.content.length,
        documents: categories.documents.length,
        media: categories.media.length,
        forms: categories.forms.length,
        other: categories.other.length
      },
      domains: {
        whitelisted: this.domainWhitelist.size,
        blacklisted: this.domainBlacklist.size
      }
    };
  }

  clear() {
    this.discoveredLinks.clear();
    this.linkHashes.clear();
  }
}

module.exports = LinkDiscovery;

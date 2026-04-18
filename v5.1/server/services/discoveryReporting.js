const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class DiscoveryReporting extends EventEmitter {
  constructor(options = {}) {
    super();
    this.outputDir = options.outputDir || 'data/crawling/reports';
    this.realTimeUpdates = options.realTimeUpdates !== false;
    this.includeScreenshots = options.includeScreenshots || false;
    this.maxReportHistory = options.maxReportHistory || 50;
    
    this.currentReport = null;
    this.reportHistory = [];
    this.startTime = null;
  }

  async initialize(domain) {
    this.startTime = new Date();
    this.currentReport = {
      domain,
      startTime: this.startTime.toISOString(),
      endTime: null,
      status: 'initializing',
      config: {},
      stats: {
        totalDiscovered: 0,
        totalProcessed: 0,
        totalFailed: 0,
        totalSkipped: 0,
        totalDuplicates: 0,
        processingRate: 0,
        averageResponseTime: 0,
        dataSize: 0
      },
      categories: {
        homepage: 0,
        navigation: 0,
        content: 0,
        documents: 0,
        media: 0,
        forms: 0,
        other: 0
      },
      pages: [],
      errors: [],
      duplicates: [],
      timeline: []
    };
    
    await this.ensureOutputDirectory();
    this.addTimelineEvent('report_initialized', { domain });
  }

  async ensureOutputDirectory() {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  updateConfig(config) {
    if (this.currentReport) {
      this.currentReport.config = { ...this.currentReport.config, ...config };
      this.addTimelineEvent('config_updated', config);
      this.emit('configUpdated', config);
    }
  }

  addPageDiscovered(pageData) {
    if (!this.currentReport) return;
    
    const pageReport = {
      url: pageData.url,
      title: pageData.title || 'Untitled',
      depth: pageData.depth || 0,
      status: 'discovered',
      discoveredAt: new Date().toISOString(),
      contentType: pageData.contentType || 'unknown',
      category: this.categorizePage(pageData),
      size: pageData.size || 0,
      responseTime: pageData.responseTime || 0,
      parentUrl: pageData.parentUrl
    };
    
    this.currentReport.pages.push(pageReport);
    this.currentReport.stats.totalDiscovered++;
    this.currentReport.categories[pageReport.category]++;
    
    this.addTimelineEvent('page_discovered', {
      url: pageData.url,
      depth: pageData.depth,
      totalDiscovered: this.currentReport.stats.totalDiscovered
    });
    
    this.emit('pageDiscovered', pageReport);
    
    if (this.realTimeUpdates) {
      this.saveRealTimeUpdate();
    }
  }

  addPageProcessed(pageData) {
    if (!this.currentReport) return;
    
    const pageIndex = this.currentReport.pages.findIndex(p => p.url === pageData.url);
    if (pageIndex === -1) return;
    
    const pageReport = this.currentReport.pages[pageIndex];
    pageReport.status = 'processed';
    pageReport.processedAt = new Date().toISOString();
    pageReport.responseTime = pageData.responseTime || pageReport.responseTime;
    pageReport.size = pageData.size || pageReport.size;
    pageReport.contentType = pageData.contentType || pageReport.contentType;
    pageReport.screenshotPath = pageData.screenshotPath;
    pageReport.htmlPath = pageData.htmlPath;
    
    this.currentReport.stats.totalProcessed++;
    this.updateProcessingRate();
    this.updateAverageResponseTime(pageReport.responseTime);
    
    this.addTimelineEvent('page_processed', {
      url: pageData.url,
      responseTime: pageReport.responseTime,
      totalProcessed: this.currentReport.stats.totalProcessed
    });
    
    this.emit('pageProcessed', pageReport);
    
    if (this.realTimeUpdates) {
      this.saveRealTimeUpdate();
    }
  }

  addPageFailed(pageData, error) {
    if (!this.currentReport) return;
    
    const pageIndex = this.currentReport.pages.findIndex(p => p.url === pageData.url);
    if (pageIndex === -1) return;
    
    const pageReport = this.currentReport.pages[pageIndex];
    pageReport.status = 'failed';
    pageReport.failedAt = new Date().toISOString();
    pageReport.error = {
      message: error.message || 'Unknown error',
      code: error.code || 'UNKNOWN',
      statusCode: error.status || null
    };
    
    this.currentReport.stats.totalFailed++;
    
    const errorReport = {
      url: pageData.url,
      error: pageReport.error,
      timestamp: pageReport.failedAt,
      depth: pageReport.depth
    };
    
    this.currentReport.errors.push(errorReport);
    
    this.addTimelineEvent('page_failed', {
      url: pageData.url,
      error: error.message,
      totalFailed: this.currentReport.stats.totalFailed
    });
    
    this.emit('pageFailed', errorReport);
    
    if (this.realTimeUpdates) {
      this.saveRealTimeUpdate();
    }
  }

  addDuplicateFound(pageData, duplicateInfo) {
    if (!this.currentReport) return;
    
    const duplicateReport = {
      url: pageData.url,
      originalUrl: duplicateInfo.originalUrl,
      duplicateType: duplicateInfo.duplicateType,
      similarity: duplicateInfo.similarity || 0,
      hashMatches: duplicateInfo.hashMatches,
      timestamp: new Date().toISOString()
    };
    
    this.currentReport.duplicates.push(duplicateReport);
    this.currentReport.stats.totalDuplicates++;
    
    this.addTimelineEvent('duplicate_found', {
      url: pageData.url,
      originalUrl: duplicateInfo.originalUrl,
      type: duplicateInfo.duplicateType
    });
    
    this.emit('duplicateFound', duplicateReport);
  }

  categorizePage(pageData) {
    const url = pageData.url.toLowerCase();
    const title = (pageData.title || '').toLowerCase();
    
    if (url === '/' || url.endsWith('/index.html') || url.endsWith('/index.php')) {
      return 'homepage';
    }
    
    if (this.isNavigationPage(url, title)) {
      return 'navigation';
    }
    
    if (this.isDocumentPage(url)) {
      return 'documents';
    }
    
    if (this.isMediaPage(url)) {
      return 'media';
    }
    
    if (this.isFormPage(url, title)) {
      return 'forms';
    }
    
    return 'content';
  }

  isNavigationPage(url, title) {
    const navKeywords = ['home', 'about', 'contact', 'menu', 'nav', 'header', 'footer'];
    return navKeywords.some(keyword => url.includes(keyword) || title.includes(keyword));
  }

  isDocumentPage(url) {
    const docPatterns = ['/docs/', '/documents/', '/files/', '/downloads/', '/uploads/'];
    return docPatterns.some(pattern => url.includes(pattern));
  }

  isMediaPage(url) {
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.mp3', '.pdf'];
    return mediaExtensions.some(ext => url.includes(ext));
  }

  isFormPage(url, title) {
    const formKeywords = ['contact', 'submit', 'apply', 'register', 'signup', 'form'];
    return formKeywords.some(keyword => url.includes(keyword) || title.includes(keyword));
  }

  updateProcessingRate() {
    if (!this.startTime) return;
    
    const elapsedMs = Date.now() - this.startTime.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);
    
    if (elapsedMinutes > 0) {
      this.currentReport.stats.processingRate = 
        Math.round((this.currentReport.stats.totalProcessed / elapsedMinutes) * 100) / 100;
    }
  }

  updateAverageResponseTime(responseTime) {
    const currentAvg = this.currentReport.stats.averageResponseTime;
    const totalProcessed = this.currentReport.stats.totalProcessed;
    
    this.currentReport.stats.averageResponseTime = 
      Math.round(((currentAvg * (totalProcessed - 1)) + responseTime) / totalProcessed * 100) / 100;
  }

  addTimelineEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    };
    
    this.currentReport.timeline.push(event);
    
    // Keep only last 1000 timeline events
    if (this.currentReport.timeline.length > 1000) {
      this.currentReport.timeline = this.currentReport.timeline.slice(-1000);
    }
    
    this.emit('timelineEvent', event);
  }

  async finalizeReport() {
    if (!this.currentReport) return;
    
    this.currentReport.endTime = new Date().toISOString();
    this.currentReport.status = 'completed';
    
    // Calculate final statistics
    this.updateProcessingRate();
    this.calculateFinalStats();
    
    // Save report
    await this.saveReport();
    
    // Add to history
    this.reportHistory.unshift({ ...this.currentReport });
    if (this.reportHistory.length > this.maxReportHistory) {
      this.reportHistory = this.reportHistory.slice(0, this.maxReportHistory);
    }
    
    this.addTimelineEvent('report_finalized', {
      totalDiscovered: this.currentReport.stats.totalDiscovered,
      totalProcessed: this.currentReport.stats.totalProcessed,
      totalFailed: this.currentReport.stats.totalFailed
    });
    
    this.emit('reportFinalized', this.currentReport);
    
    return this.currentReport;
  }

  calculateFinalStats() {
    const report = this.currentReport;
    
    // Success rate
    const totalAttempts = report.stats.totalProcessed + report.stats.totalFailed;
    report.stats.successRate = totalAttempts > 0 
      ? Math.round((report.stats.totalProcessed / totalAttempts) * 100 * 100) / 100
      : 0;
    
    // Discovery rate
    report.stats.discoveryRate = report.stats.totalDiscovered > 0
      ? Math.round((report.stats.totalProcessed / report.stats.totalDiscovered) * 100 * 100) / 100
      : 0;
    
    // Duplicate rate
    report.stats.duplicateRate = report.stats.totalDiscovered > 0
      ? Math.round((report.stats.totalDuplicates / report.stats.totalDiscovered) * 100 * 100) / 100
      : 0;
    
    // Processing duration
    if (report.startTime && report.endTime) {
      const duration = new Date(report.endTime) - new Date(report.startTime);
      report.stats.duration = {
        milliseconds: duration,
        seconds: Math.round(duration / 1000 * 100) / 100,
        minutes: Math.round(duration / (1000 * 60) * 100) / 100,
        hours: Math.round(duration / (1000 * 60 * 60) * 100) / 100
      };
    }
    
    // Category distribution
    const total = report.stats.totalDiscovered;
    report.stats.categoryDistribution = {};
    for (const [category, count] of Object.entries(report.categories)) {
      report.stats.categoryDistribution[category] = total > 0
        ? Math.round((count / total) * 100 * 100) / 100
        : 0;
    }
  }

  async saveReport() {
    if (!this.currentReport) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `discovery_report_${this.currentReport.domain}_${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(this.currentReport, null, 2));
      
      // Also save as latest report
      const latestFile = path.join(this.outputDir, 'latest_report.json');
      await fs.writeFile(latestFile, JSON.stringify(this.currentReport, null, 2));
      
      this.emit('reportSaved', { filepath, filename });
      
    } catch (error) {
      console.error('Error saving report:', error);
      this.emit('reportSaveError', { error });
    }
  }

  async saveRealTimeUpdate() {
    if (!this.currentReport) return;
    
    const realtimeFile = path.join(this.outputDir, 'realtime_update.json');
    
    try {
      const updateData = {
        domain: this.currentReport.domain,
        timestamp: new Date().toISOString(),
        stats: this.currentReport.stats,
        categories: this.currentReport.categories,
        recentPages: this.currentReport.pages.slice(-10),
        recentErrors: this.currentReport.errors.slice(-5)
      };
      
      await fs.writeFile(realtimeFile, JSON.stringify(updateData, null, 2));
      
    } catch (error) {
      console.error('Error saving real-time update:', error);
    }
  }

  generateSummary() {
    if (!this.currentReport) return null;
    
    const report = this.currentReport;
    
    return {
      domain: report.domain,
      status: report.status,
      duration: report.stats.duration,
      stats: {
        discovered: report.stats.totalDiscovered,
        processed: report.stats.totalProcessed,
        failed: report.stats.totalFailed,
        duplicates: report.stats.totalDuplicates,
        successRate: report.stats.successRate,
        processingRate: report.stats.processingRate
      },
      categories: report.categories,
      topErrors: this.getTopErrors(5),
      recentActivity: report.timeline.slice(-10)
    };
  }

  getTopErrors(limit = 5) {
    if (!this.currentReport) return [];
    
    const errorCounts = {};
    
    for (const error of this.currentReport.errors) {
      const key = `${error.error.code || 'UNKNOWN'}: ${error.error.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    }
    
    return Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([error, count]) => ({ error, count }));
  }

  getCurrentReport() {
    return this.currentReport;
  }

  getReportHistory() {
    return this.reportHistory;
  }

  getReportStats() {
    if (!this.currentReport) return null;
    
    return {
      ...this.currentReport.stats,
      categories: this.currentReport.categories,
      errorCount: this.currentReport.errors.length,
      duplicateCount: this.currentReport.duplicates.length,
      timelineEvents: this.currentReport.timeline.length
    };
  }

  async exportReport(format = 'json') {
    if (!this.currentReport) return null;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const domain = this.currentReport.domain.replace(/[^a-zA-Z0-9]/g, '_');
    
    switch (format.toLowerCase()) {
      case 'json':
        return await this.exportJSON(timestamp, domain);
      case 'csv':
        return await this.exportCSV(timestamp, domain);
      case 'html':
        return await this.exportHTML(timestamp, domain);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async exportJSON(timestamp, domain) {
    const filename = `discovery_report_${domain}_${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(this.currentReport, null, 2));
    return filepath;
  }

  async exportCSV(timestamp, domain) {
    const filename = `discovery_report_${domain}_${timestamp}.csv`;
    const filepath = path.join(this.outputDir, filename);
    
    const csvHeaders = [
      'URL', 'Title', 'Status', 'Depth', 'Category', 'ContentType',
      'ResponseTime', 'Size', 'DiscoveredAt', 'ProcessedAt', 'Error'
    ];
    
    const csvRows = [csvHeaders.join(',')];
    
    for (const page of this.currentReport.pages) {
      const row = [
        `"${page.url}"`,
        `"${page.title}"`,
        page.status,
        page.depth,
        page.category,
        page.contentType,
        page.responseTime,
        page.size,
        page.discoveredAt,
        page.processedAt || '',
        page.error ? `"${page.error.message}"` : ''
      ];
      csvRows.push(row.join(','));
    }
    
    await fs.writeFile(filepath, csvRows.join('\n'));
    return filepath;
  }

  async exportHTML(timestamp, domain) {
    const filename = `discovery_report_${domain}_${timestamp}.html`;
    const filepath = path.join(this.outputDir, filename);
    
    const html = this.generateHTMLReport();
    await fs.writeFile(filepath, html);
    return filepath;
  }

  generateHTMLReport() {
    const report = this.currentReport;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Discovery Report - ${report.domain}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-box { background: #e9ecef; padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background: #f2f2f2; }
        .status-processed { color: green; }
        .status-failed { color: red; }
        .status-discovered { color: blue; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Discovery Report</h1>
        <p><strong>Domain:</strong> ${report.domain}</p>
        <p><strong>Start Time:</strong> ${report.startTime}</p>
        <p><strong>End Time:</strong> ${report.endTime || 'In Progress'}</p>
    </div>
    
    <div class="stats">
        <div class="stat-box">
            <h3>${report.stats.totalDiscovered}</h3>
            <p>Pages Discovered</p>
        </div>
        <div class="stat-box">
            <h3>${report.stats.totalProcessed}</h3>
            <p>Pages Processed</p>
        </div>
        <div class="stat-box">
            <h3>${report.stats.totalFailed}</h3>
            <p>Pages Failed</p>
        </div>
        <div class="stat-box">
            <h3>${report.stats.successRate || 0}%</h3>
            <p>Success Rate</p>
        </div>
    </div>
    
    <h2>Discovered Pages</h2>
    <table class="table">
        <thead>
            <tr>
                <th>URL</th>
                <th>Title</th>
                <th>Status</th>
                <th>Depth</th>
                <th>Category</th>
                <th>Response Time</th>
            </tr>
        </thead>
        <tbody>
            ${report.pages.map(page => `
                <tr>
                    <td><a href="${page.url}" target="_blank">${page.url}</a></td>
                    <td>${page.title}</td>
                    <td class="status-${page.status}">${page.status}</td>
                    <td>${page.depth}</td>
                    <td>${page.category}</td>
                    <td>${page.responseTime}ms</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
  }
}

module.exports = DiscoveryReporting;

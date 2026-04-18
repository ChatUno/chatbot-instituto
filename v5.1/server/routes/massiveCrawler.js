const express = require('express');
const router = express.Router();
const MassiveCrawler = require('../services/massiveCrawler');
const QueueManager = require('../services/queueManager');
const LinkDiscovery = require('../services/linkDiscovery');
const RateLimiter = require('../services/rateLimiter');
const RetrySystem = require('../services/retrySystem');
const StatePersistence = require('../services/statePersistence');
const DuplicateDetection = require('../services/duplicateDetection');
const DiscoveryReporting = require('../services/discoveryReporting');

// Global instances for managing crawling sessions
const crawlingSessions = new Map();

// Initialize services for a new crawling session
async function initializeCrawlingSession(sessionId, options = {}) {
  const crawler = new MassiveCrawler(options.crawler);
  const queueManager = new QueueManager(options.queue);
  const linkDiscovery = new LinkDiscovery(options.discovery);
  const rateLimiter = new RateLimiter(options.rateLimiter);
  const retrySystem = new RetrySystem(options.retry);
  const statePersistence = new StatePersistence(options.state);
  const duplicateDetection = new DuplicateDetection(options.duplicate);
  const discoveryReporting = new DiscoveryReporting(options.reporting);

  // Initialize services
  await crawler.initialize();
  await queueManager.initialize();
  await statePersistence.initialize();

  // Set up event handlers
  setupEventHandlers(sessionId, {
    crawler,
    queueManager,
    linkDiscovery,
    rateLimiter,
    retrySystem,
    statePersistence,
    duplicateDetection,
    discoveryReporting
  });

  const session = {
    id: sessionId,
    crawler,
    queueManager,
    linkDiscovery,
    rateLimiter,
    retrySystem,
    statePersistence,
    duplicateDetection,
    discoveryReporting,
    status: 'initialized',
    startTime: new Date(),
    options
  };

  crawlingSessions.set(sessionId, session);
  return session;
}

function setupEventHandlers(sessionId, services) {
  const { crawler, queueManager, discoveryReporting } = services;

  // Crawler events
  crawler.on('started', (data) => {
    discoveryReporting.addTimelineEvent('crawling_started', data);
  });

  crawler.on('pageProcessed', (pageData) => {
    discoveryReporting.addPageProcessed(pageData);
  });

  crawler.on('completed', (stats) => {
    discoveryReporting.addTimelineEvent('crawling_completed', stats);
  });

  // Queue events
  queueManager.on('metrics', (stats) => {
    // Could be used for real-time updates
  });
}

// Start massive crawling
router.post('/start', async (req, res) => {
  try {
    const { url, options = {} } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        code: 'MISSING_URL'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    }

    // Generate session ID
    const sessionId = `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize crawling session
    const session = await initializeCrawlingSession(sessionId, options);
    
    // Initialize reporting
    await session.discoveryReporting.initialize(new URL(url).hostname);
    
    // Process the configuration to handle patterns before saving to report
    const processedOptions = {
      ...options,
      discovery: {
        ...options.discovery,
        excludePatterns: options.discovery?.excludePatterns?.map(pattern => 
          pattern instanceof RegExp ? pattern.toString() : pattern
        ) || [],
        includePatterns: options.discovery?.includePatterns?.map(pattern => 
          pattern instanceof RegExp ? pattern.toString() : pattern
        ) || []
      }
    };
    session.discoveryReporting.updateConfig(processedOptions);

    // Start crawling
    session.status = 'running';
    const crawlPromise = session.crawler.crawl(url);

    // Handle completion
    crawlPromise.then(async (result) => {
      session.status = 'completed';
      await session.discoveryReporting.finalizeReport();
      await session.statePersistence.destroy();
    }).catch(async (error) => {
      session.status = 'failed';
      session.error = error.message;
      await session.discoveryReporting.finalizeReport();
      await session.statePersistence.destroy();
    });

    res.json({
      success: true,
      sessionId,
      status: 'started',
      url,
      message: 'Massive crawling started successfully'
    });

  } catch (error) {
    console.error('Error starting massive crawling:', error);
    res.status(500).json({
      error: 'Failed to start crawling',
      code: 'START_FAILED',
      details: error.message
    });
  }
});

// Get crawling status
router.get('/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const stats = session.crawler.getStats();
    const queueStats = session.queueManager.getQueueStats();
    const reportStats = session.discoveryReporting.getReportStats();

    res.json({
      success: true,
      sessionId,
      status: session.status,
      startTime: session.startTime,
      stats,
      queueStats,
      reportStats,
      error: session.error || null
    });

  } catch (error) {
    console.error('Error getting crawling status:', error);
    res.status(500).json({
      error: 'Failed to get crawling status',
      code: 'STATUS_FAILED',
      details: error.message
    });
  }
});

// Stop crawling
router.post('/stop/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    await session.crawler.stop();
    await session.statePersistence.destroy();
    session.status = 'stopped';

    res.json({
      success: true,
      sessionId,
      status: 'stopped',
      message: 'Crawling stopped successfully'
    });

  } catch (error) {
    console.error('Error stopping crawling:', error);
    res.status(500).json({
      error: 'Failed to stop crawling',
      code: 'STOP_FAILED',
      details: error.message
    });
  }
});

// Get discovery report
router.get('/report/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = 'json' } = req.query;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const report = session.discoveryReporting.getCurrentReport();

    if (!report) {
      return res.status(404).json({
        error: 'No report available for this session',
        code: 'NO_REPORT'
      });
    }

    if (format === 'json') {
      res.json({
        success: true,
        sessionId,
        report
      });
    } else {
      // Export to other formats
      const exportedFile = await session.discoveryReporting.exportReport(format);
      res.json({
        success: true,
        sessionId,
        exportedFile,
        format
      });
    }

  } catch (error) {
    console.error('Error getting discovery report:', error);
    res.status(500).json({
      error: 'Failed to get discovery report',
      code: 'REPORT_FAILED',
      details: error.message
    });
  }
});

// Get crawling statistics
router.get('/stats/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const crawlerStats = session.crawler.getStats();
    const queueStats = session.queueManager.getQueueStats();
    const rateLimiterStats = session.rateLimiter.getAllStats();
    const retryStats = session.retrySystem.getStats();
    const duplicateStats = session.duplicateDetection.getStats();
    const reportSummary = session.discoveryReporting.generateSummary();

    res.json({
      success: true,
      sessionId,
      crawler: crawlerStats,
      queue: queueStats,
      rateLimiter: rateLimiterStats,
      retry: retryStats,
      duplicate: duplicateStats,
      report: reportSummary
    });

  } catch (error) {
    console.error('Error getting crawling statistics:', error);
    res.status(500).json({
      error: 'Failed to get crawling statistics',
      code: 'STATS_FAILED',
      details: error.message
    });
  }
});

// List all crawling sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = Array.from(crawlingSessions.entries()).map(([id, session]) => ({
      id,
      status: session.status,
      startTime: session.startTime,
      url: session.options.crawler?.baseUrl || 'unknown',
      stats: session.crawler?.getStats() || null
    }));

    res.json({
      success: true,
      sessions,
      total: sessions.length
    });

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      error: 'Failed to list sessions',
      code: 'LIST_FAILED',
      details: error.message
    });
  }
});

// Delete crawling session
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Clean up session
    if (session.crawler) {
      await session.crawler.stop();
    }
    if (session.statePersistence) {
      await session.statePersistence.destroy();
    }

    crawlingSessions.delete(sessionId);

    res.json({
      success: true,
      sessionId,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Failed to delete session',
      code: 'DELETE_FAILED',
      details: error.message
    });
  }
});

// Update crawling configuration
router.put('/config/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { config } = req.body;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    if (!config) {
      return res.status(400).json({
        error: 'Configuration is required',
        code: 'MISSING_CONFIG'
      });
    }

    // Update rate limiter if provided
    if (config.rateLimiter) {
      session.rateLimiter.updateConfig(config.rateLimiter);
    }

    // Update retry system if provided
    if (config.retry) {
      session.retrySystem.updateConfig(config.retry);
    }

    // Update discovery reporting if provided
    if (config.reporting) {
      session.discoveryReporting.updateConfig(config.reporting);
    }

    session.discoveryReporting.addTimelineEvent('config_updated', config);

    res.json({
      success: true,
      sessionId,
      message: 'Configuration updated successfully'
    });

  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      error: 'Failed to update configuration',
      code: 'CONFIG_UPDATE_FAILED',
      details: error.message
    });
  }
});

// Get rate limiter statistics for a domain
router.get('/rate-limit/:sessionId/:domain', async (req, res) => {
  try {
    const { sessionId, domain } = req.params;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const domainStats = session.rateLimiter.getDomainStats(domain);

    if (!domainStats) {
      return res.status(404).json({
        error: 'No statistics found for this domain',
        code: 'NO_DOMAIN_STATS'
      });
    }

    res.json({
      success: true,
      sessionId,
      domain,
      stats: domainStats
    });

  } catch (error) {
    console.error('Error getting rate limiter statistics:', error);
    res.status(500).json({
      error: 'Failed to get rate limiter statistics',
      code: 'RATE_LIMIT_STATS_FAILED',
      details: error.message
    });
  }
});

// Set domain rate limit manually
router.post('/rate-limit/:sessionId/:domain', async (req, res) => {
  try {
    const { sessionId, domain } = req.params;
    const { delay } = req.body;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    if (typeof delay !== 'number' || delay < 0) {
      return res.status(400).json({
        error: 'Valid delay is required (must be a positive number)',
        code: 'INVALID_DELAY'
      });
    }

    session.rateLimiter.setDomainDelay(domain, delay);

    res.json({
      success: true,
      sessionId,
      domain,
      delay,
      message: 'Rate limit updated successfully'
    });

  } catch (error) {
    console.error('Error setting rate limit:', error);
    res.status(500).json({
      error: 'Failed to set rate limit',
      code: 'RATE_LIMIT_SET_FAILED',
      details: error.message
    });
  }
});

// Get discovered pages
router.get('/pages/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      status = 'all', 
      category = 'all' 
    } = req.query;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const report = session.discoveryReporting.getCurrentReport();
    if (!report) {
      return res.status(404).json({
        error: 'No report available for this session',
        code: 'NO_REPORT'
      });
    }

    let pages = report.pages;

    // Filter by status
    if (status !== 'all') {
      pages = pages.filter(page => page.status === status);
    }

    // Filter by category
    if (category !== 'all') {
      pages = pages.filter(page => page.category === category);
    }

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPages = pages.slice(startIndex, endIndex);

    res.json({
      success: true,
      sessionId,
      pages: paginatedPages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: pages.length,
        pages: Math.ceil(pages.length / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error getting pages:', error);
    res.status(500).json({
      error: 'Failed to get pages',
      code: 'PAGES_FAILED',
      details: error.message
    });
  }
});

// Get errors
router.get('/errors/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const session = crawlingSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Crawling session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const report = session.discoveryReporting.getCurrentReport();
    if (!report) {
      return res.status(404).json({
        error: 'No report available for this session',
        code: 'NO_REPORT'
      });
    }

    const errors = report.errors;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedErrors = errors.slice(startIndex, endIndex);

    res.json({
      success: true,
      sessionId,
      errors: paginatedErrors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: errors.length,
        pages: Math.ceil(errors.length / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error getting errors:', error);
    res.status(500).json({
      error: 'Failed to get errors',
      code: 'ERRORS_FAILED',
      details: error.message
    });
  }
});

module.exports = router;

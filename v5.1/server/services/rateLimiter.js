const EventEmitter = require('events');

class RateLimiter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.defaultDelay = options.defaultDelay || 1000;
    this.maxDelay = options.maxDelay || 10000;
    this.minDelay = options.minDelay || 100;
    this.adaptiveMode = options.adaptiveMode !== false;
    this.errorThreshold = options.errorThreshold || 3;
    this.successThreshold = options.successThreshold || 10;
    
    this.domainLimits = new Map();
    this.globalStats = {
      totalRequests: 0,
      totalErrors: 0,
      totalSuccesses: 0,
      startTime: Date.now()
    };
  }

  async wait(domain) {
    const limiter = this.getDomainLimiter(domain);
    const now = Date.now();
    
    if (limiter.lastRequest && now - limiter.lastRequest < limiter.currentDelay) {
      const waitTime = limiter.currentDelay - (now - limiter.lastRequest);
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }
    
    limiter.lastRequest = Date.now();
    limiter.requestCount++;
    this.globalStats.totalRequests++;
    
    this.emit('request', { domain, delay: limiter.currentDelay });
  }

  recordSuccess(domain, responseTime = null) {
    const limiter = this.getDomainLimiter(domain);
    limiter.successCount++;
    limiter.consecutiveSuccesses++;
    limiter.consecutiveErrors = 0;
    
    if (responseTime) {
      limiter.responseTimes.push(responseTime);
      if (limiter.responseTimes.length > 10) {
        limiter.responseTimes.shift();
      }
    }
    
    // Adaptive rate limiting: decrease delay on consecutive successes
    if (this.adaptiveMode && limiter.consecutiveSuccesses >= this.successThreshold) {
      this.adjustRate(domain, 'decrease');
      limiter.consecutiveSuccesses = 0;
    }
    
    this.globalStats.totalSuccesses++;
    this.emit('success', { domain, currentDelay: limiter.currentDelay });
  }

  recordError(domain, error = null) {
    const limiter = this.getDomainLimiter(domain);
    limiter.errorCount++;
    limiter.consecutiveErrors++;
    limiter.consecutiveSuccesses = 0;
    
    // Adaptive rate limiting: increase delay on consecutive errors
    if (this.adaptiveMode && limiter.consecutiveErrors >= this.errorThreshold) {
      this.adjustRate(domain, 'increase');
      limiter.consecutiveErrors = 0;
    }
    
    // Specific error handling
    if (error) {
      this.handleSpecificError(domain, error);
    }
    
    this.globalStats.totalErrors++;
    this.emit('error', { domain, error, currentDelay: limiter.currentDelay });
  }

  handleSpecificError(domain, error) {
    const limiter = this.getDomainLimiter(domain);
    
    // HTTP status code based adjustments
    if (error.status) {
      switch (error.status) {
        case 429: // Too Many Requests
          limiter.currentDelay = Math.min(limiter.currentDelay * 3, this.maxDelay);
          break;
        case 503: // Service Unavailable
          limiter.currentDelay = Math.min(limiter.currentDelay * 2, this.maxDelay);
          break;
        case 403: // Forbidden
          limiter.currentDelay = Math.min(limiter.currentDelay * 1.5, this.maxDelay);
          break;
        case 500: // Internal Server Error
        case 502: // Bad Gateway
          limiter.currentDelay = Math.min(limiter.currentDelay * 1.2, this.maxDelay);
          break;
      }
    }
    
    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      limiter.currentDelay = Math.min(limiter.currentDelay * 1.5, this.maxDelay);
    }
    
    // Connection errors
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      limiter.currentDelay = Math.min(limiter.currentDelay * 2, this.maxDelay);
    }
  }

  adjustRate(domain, direction) {
    const limiter = this.getDomainLimiter(domain);
    
    if (direction === 'increase') {
      // Increase delay (slow down)
      limiter.currentDelay = Math.min(limiter.currentDelay * 1.5, this.maxDelay);
      limiter.adjustmentHistory.push({
        timestamp: Date.now(),
        type: 'increase',
        oldDelay: limiter.currentDelay / 1.5,
        newDelay: limiter.currentDelay,
        reason: 'consecutive_errors'
      });
    } else if (direction === 'decrease') {
      // Decrease delay (speed up)
      limiter.currentDelay = Math.max(limiter.currentDelay * 0.8, this.minDelay);
      limiter.adjustmentHistory.push({
        timestamp: Date.now(),
        type: 'decrease',
        oldDelay: limiter.currentDelay / 0.8,
        newDelay: limiter.currentDelay,
        reason: 'consecutive_successes'
      });
    }
    
    // Keep only last 20 adjustments
    if (limiter.adjustmentHistory.length > 20) {
      limiter.adjustmentHistory = limiter.adjustmentHistory.slice(-20);
    }
    
    this.emit('adjustment', { 
      domain, 
      direction, 
      newDelay: limiter.currentDelay,
      adjustmentHistory: limiter.adjustmentHistory
    });
  }

  getDomainLimiter(domain) {
    if (!this.domainLimits.has(domain)) {
      this.domainLimits.set(domain, {
        domain,
        currentDelay: this.defaultDelay,
        lastRequest: null,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        consecutiveSuccesses: 0,
        consecutiveErrors: 0,
        responseTimes: [],
        adjustmentHistory: [],
        createdAt: Date.now()
      });
    }
    
    return this.domainLimits.get(domain);
  }

  setDomainDelay(domain, delay) {
    const limiter = this.getDomainLimiter(domain);
    const oldDelay = limiter.currentDelay;
    limiter.currentDelay = Math.max(Math.min(delay, this.maxDelay), this.minDelay);
    
    this.emit('manualAdjustment', { 
      domain, 
      oldDelay, 
      newDelay: limiter.currentDelay 
    });
  }

  getDomainStats(domain) {
    const limiter = this.domainLimits.get(domain);
    if (!limiter) return null;
    
    const avgResponseTime = limiter.responseTimes.length > 0
      ? limiter.responseTimes.reduce((a, b) => a + b, 0) / limiter.responseTimes.length
      : 0;
    
    const errorRate = limiter.requestCount > 0
      ? (limiter.errorCount / limiter.requestCount) * 100
      : 0;
    
    const successRate = limiter.requestCount > 0
      ? (limiter.successCount / limiter.requestCount) * 100
      : 0;
    
    return {
      domain,
      currentDelay: limiter.currentDelay,
      requestCount: limiter.requestCount,
      successCount: limiter.successCount,
      errorCount: limiter.errorCount,
      errorRate: Math.round(errorRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      consecutiveSuccesses: limiter.consecutiveSuccesses,
      consecutiveErrors: limiter.consecutiveErrors,
      uptime: Date.now() - limiter.createdAt
    };
  }

  getAllStats() {
    const domainStats = Array.from(this.domainLimits.keys()).map(domain => 
      this.getDomainStats(domain)
    );
    
    const totalUptime = Date.now() - this.globalStats.startTime;
    const globalErrorRate = this.globalStats.totalRequests > 0
      ? (this.globalStats.totalErrors / this.globalStats.totalRequests) * 100
      : 0;
    
    const globalSuccessRate = this.globalStats.totalRequests > 0
      ? (this.globalStats.totalSuccesses / this.globalStats.totalRequests) * 100
      : 0;
    
    return {
      global: {
        totalRequests: this.globalStats.totalRequests,
        totalErrors: this.globalStats.totalErrors,
        totalSuccesses: this.globalStats.totalSuccesses,
        errorRate: Math.round(globalErrorRate * 100) / 100,
        successRate: Math.round(globalSuccessRate * 100) / 100,
        uptime: totalUptime,
        activeDomains: this.domainLimits.size
      },
      domains: domainStats,
      summary: {
        avgDelay: domainStats.length > 0
          ? Math.round(domainStats.reduce((sum, stat) => sum + stat.currentDelay, 0) / domainStats.length)
          : this.defaultDelay,
        maxDelay: Math.max(...domainStats.map(stat => stat.currentDelay), this.defaultDelay),
        minDelay: Math.min(...domainStats.map(stat => stat.currentDelay), this.defaultDelay),
        totalAdjustments: domainStats.reduce((sum, stat) => sum + this.domainLimits.get(stat.domain).adjustmentHistory.length, 0)
      }
    };
  }

  resetDomain(domain) {
    const limiter = this.domainLimits.get(domain);
    if (limiter) {
      limiter.currentDelay = this.defaultDelay;
      limiter.lastRequest = null;
      limiter.requestCount = 0;
      limiter.successCount = 0;
      limiter.errorCount = 0;
      limiter.consecutiveSuccesses = 0;
      limiter.consecutiveErrors = 0;
      limiter.responseTimes = [];
      limiter.adjustmentHistory = [];
      
      this.emit('reset', { domain });
    }
  }

  resetAll() {
    this.domainLimits.clear();
    this.globalStats = {
      totalRequests: 0,
      totalErrors: 0,
      totalSuccesses: 0,
      startTime: Date.now()
    };
    
    this.emit('resetAll');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Advanced rate limiting strategies
  setDomainStrategy(domain, strategy) {
    const limiter = this.getDomainLimiter(domain);
    limiter.strategy = strategy;
    
    switch (strategy) {
      case 'aggressive':
        limiter.currentDelay = this.minDelay;
        limiter.successThreshold = 5;
        limiter.errorThreshold = 2;
        break;
      case 'conservative':
        limiter.currentDelay = this.defaultDelay * 2;
        limiter.successThreshold = 15;
        limiter.errorThreshold = 5;
        break;
      case 'adaptive':
        limiter.currentDelay = this.defaultDelay;
        limiter.successThreshold = 10;
        limiter.errorThreshold = 3;
        break;
      default:
        limiter.currentDelay = this.defaultDelay;
    }
    
    this.emit('strategyChange', { domain, strategy });
  }

  getOptimalDelay(domain) {
    const stats = this.getDomainStats(domain);
    if (!stats) return this.defaultDelay;
    
    // Calculate optimal delay based on error rate and response time
    let optimalDelay = this.defaultDelay;
    
    if (stats.errorRate > 10) {
      optimalDelay = Math.min(stats.currentDelay * 1.5, this.maxDelay);
    } else if (stats.errorRate < 2 && stats.avgResponseTime < 1000) {
      optimalDelay = Math.max(stats.currentDelay * 0.8, this.minDelay);
    }
    
    return optimalDelay;
  }
}

module.exports = RateLimiter;

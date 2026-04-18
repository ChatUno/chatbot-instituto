const EventEmitter = require('events');

class RetrySystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxAttempts = options.maxAttempts || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffFactor = options.backoffFactor || 2;
    this.jitter = options.jitter !== false;
    this.retryableErrors = options.retryableErrors || [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EAI_AGAIN'
    ];
    this.retryableStatusCodes = options.retryableStatusCodes || [
      408, // Request Timeout
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
      507, // Insufficient Storage
      509, // Bandwidth Limit Exceeded
      520, // Unknown Error
      521, // Web Server Is Down
      522, // Connection Timed Out
      523, // Origin Is Unreachable
      524  // A Timeout Occurred
    ];
    
    this.retryAttempts = new Map();
    this.retryQueue = [];
    this.processing = false;
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      totalSaved: 0
    };
  }

  async executeWithRetry(operation, context = {}) {
    const operationId = this.generateOperationId(context);
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;
        
        // Success - clean up retry tracking
        this.retryAttempts.delete(operationId);
        
        if (attempt > 1) {
          this.stats.successfulRetries++;
          this.emit('retrySuccess', {
            operationId,
            attempt,
            duration,
            context
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === this.maxAttempts) {
          this.retryAttempts.delete(operationId);
          this.stats.failedRetries++;
          
          this.emit('retryFailed', {
            operationId,
            attempt,
            error,
            context,
            finalAttempt: true
          });
          
          throw error;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        
        // Track retry attempt
        this.retryAttempts.set(operationId, {
          attempt,
          lastError: error,
          nextRetryTime: Date.now() + delay,
          context
        });
        
        this.stats.totalRetries++;
        
        this.emit('retryScheduled', {
          operationId,
          attempt,
          delay,
          error,
          context
        });
        
        // Wait before next attempt
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  async scheduleRetry(operation, context = {}, delay = null) {
    const operationId = this.generateOperationId(context);
    const retryDelay = delay || this.baseDelay;
    
    const retryItem = {
      id: operationId,
      operation,
      context,
      scheduledTime: Date.now() + retryDelay,
      attempts: 1,
      createdAt: Date.now()
    };
    
    this.retryQueue.push(retryItem);
    this.retryQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
    
    this.emit('retryScheduled', {
      operationId,
      delay: retryDelay,
      context
    });
    
    if (!this.processing) {
      this.processRetryQueue();
    }
    
    return operationId;
  }

  async processRetryQueue() {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.retryQueue.length > 0) {
      const now = Date.now();
      const nextRetry = this.retryQueue[0];
      
      if (nextRetry.scheduledTime > now) {
        await this.delay(nextRetry.scheduledTime - now);
        continue;
      }
      
      // Remove from queue
      this.retryQueue.shift();
      
      try {
        await nextRetry.operation();
        this.stats.successfulRetries++;
        
        this.emit('retrySuccess', {
          operationId: nextRetry.id,
          attempt: nextRetry.attempts,
          context: nextRetry.context
        });
        
      } catch (error) {
        if (this.isRetryableError(error) && nextRetry.attempts < this.maxAttempts) {
          // Reschedule with exponential backoff
          nextRetry.attempts++;
          nextRetry.scheduledTime = Date.now() + this.calculateDelay(nextRetry.attempts);
          this.retryQueue.push(nextRetry);
          this.retryQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
          
          this.stats.totalRetries++;
          
          this.emit('retryScheduled', {
            operationId: nextRetry.id,
            attempt: nextRetry.attempts,
            delay: this.calculateDelay(nextRetry.attempts),
            error,
            context: nextRetry.context
          });
          
        } else {
          this.stats.failedRetries++;
          
          this.emit('retryFailed', {
            operationId: nextRetry.id,
            attempt: nextRetry.attempts,
            error,
            context: nextRetry.context,
            finalAttempt: true
          });
        }
      }
    }
    
    this.processing = false;
  }

  isRetryableError(error) {
    // Check error code
    if (error.code && this.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check HTTP status code
    if (error.status && this.retryableStatusCodes.includes(error.status)) {
      return true;
    }
    
    // Check error message patterns
    const retryablePatterns = [
      /timeout/i,
      /connection reset/i,
      /connection refused/i,
      /service unavailable/i,
      /too many requests/i,
      /rate limit/i,
      /temporary failure/i,
      /network error/i
    ];
    
    const message = error.message || '';
    return retryablePatterns.some(pattern => pattern.test(message));
  }

  calculateDelay(attempt) {
    // Exponential backoff with jitter
    let delay = this.baseDelay * Math.pow(this.backoffFactor, attempt - 1);
    delay = Math.min(delay, this.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (this.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }

  generateOperationId(context) {
    const { url, domain, type } = context;
    const base = url || domain || type || 'operation';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    
    return `${base}_${timestamp}_${random}`;
  }

  getRetryStatus(operationId) {
    return this.retryAttempts.get(operationId) || null;
  }

  getQueueStatus() {
    return {
      queueLength: this.retryQueue.length,
      processing: this.processing,
      nextRetry: this.retryQueue.length > 0 ? this.retryQueue[0].scheduledTime : null,
      activeRetries: this.retryAttempts.size,
      stats: this.stats
    };
  }

  cancelRetry(operationId) {
    // Remove from queue
    const queueIndex = this.retryQueue.findIndex(item => item.id === operationId);
    if (queueIndex !== -1) {
      this.retryQueue.splice(queueIndex, 1);
    }
    
    // Remove from active attempts
    const cancelled = this.retryAttempts.delete(operationId);
    
    if (cancelled) {
      this.emit('retryCancelled', { operationId });
    }
    
    return cancelled;
  }

  cancelAllRetries() {
    const cancelledCount = this.retryQueue.length + this.retryAttempts.size;
    
    this.retryQueue = [];
    this.retryAttempts.clear();
    
    this.emit('allRetriesCancelled', { cancelledCount });
    
    return cancelledCount;
  }

  updateConfig(newOptions) {
    Object.assign(this, newOptions);
    
    this.emit('configUpdated', newOptions);
  }

  getStats() {
    const successRate = this.stats.totalRetries > 0
      ? (this.stats.successfulRetries / this.stats.totalRetries) * 100
      : 0;
    
    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      queueLength: this.retryQueue.length,
      activeRetries: this.retryAttempts.size,
      processing: this.processing
    };
  }

  reset() {
    this.retryQueue = [];
    this.retryAttempts.clear();
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      totalSaved: 0
    };
    
    this.emit('reset');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Advanced retry strategies
  async circuitBreakerExecute(operation, context = {}, options = {}) {
    const {
      failureThreshold = 5,
      recoveryTimeout = 60000,
      monitoringPeriod = 300000
    } = options;
    
    const circuitKey = this.getCircuitKey(context);
    const circuit = this.getCircuitState(circuitKey);
    
    if (circuit.state === 'open') {
      if (Date.now() - circuit.openedAt > recoveryTimeout) {
        circuit.state = 'half-open';
        this.emit('circuitHalfOpen', { circuitKey });
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await this.executeWithRetry(operation, context);
      
      if (circuit.state === 'half-open') {
        circuit.state = 'closed';
        circuit.failures = 0;
        this.emit('circuitClosed', { circuitKey });
      }
      
      return result;
      
    } catch (error) {
      circuit.failures++;
      
      if (circuit.failures >= failureThreshold) {
        circuit.state = 'open';
        circuit.openedAt = Date.now();
        this.emit('circuitOpened', { circuitKey, failures: circuit.failures });
      }
      
      throw error;
    }
  }

  getCircuitKey(context) {
    return context.domain || context.url || 'default';
  }

  getCircuitState(key) {
    if (!this.circuitStates) {
      this.circuitStates = new Map();
    }
    
    if (!this.circuitStates.has(key)) {
      this.circuitStates.set(key, {
        state: 'closed',
        failures: 0,
        openedAt: null
      });
    }
    
    return this.circuitStates.get(key);
  }
}

module.exports = RetrySystem;

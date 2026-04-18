const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class QueueManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxQueueSize = options.maxQueueSize || 10000;
    this.batchSize = options.batchSize || 100;
    this.persistenceFile = options.persistenceFile || 'data/crawling/queue/state.json';
    
    this.queues = {
      pending: [],
      processing: new Set(),
      completed: new Set(),
      failed: []
    };
    
    this.stats = {
      totalEnqueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      startTime: null,
      processingRate: 0
    };
    
    this.isProcessing = false;
    this.processingInterval = null;
  }

  async initialize() {
    await this.loadState();
    this.stats.startTime = new Date();
    this.startMetricsTracking();
  }

  async enqueue(items) {
    const itemsToAdd = Array.isArray(items) ? items : [items];
    
    if (this.queues.pending.length + itemsToAdd.length > this.maxQueueSize) {
      throw new Error(`Queue size would exceed maximum of ${this.maxQueueSize}`);
    }

    for (const item of itemsToAdd) {
      const queueItem = {
        ...item,
        id: this.generateId(),
        enqueuedAt: new Date().toISOString(),
        attempts: 0,
        lastAttempt: null,
        priority: item.priority || 0
      };
      
      this.queues.pending.push(queueItem);
      this.stats.totalEnqueued++;
    }

    // Sort by priority (higher first)
    this.queues.pending.sort((a, b) => b.priority - a.priority);
    
    await this.saveState();
    this.emit('enqueued', { count: itemsToAdd.length, queueSize: this.queues.pending.length });
  }

  async getNextBatch(maxItems = null) {
    const batchSize = maxItems || this.batchSize;
    const batch = [];

    while (batch.length < batchSize && this.queues.pending.length > 0) {
      const item = this.queues.pending.shift();
      if (item) {
        this.queues.processing.add(item.id);
        item.lastAttempt = new Date().toISOString();
        item.attempts++;
        batch.push(item);
      }
    }

    if (batch.length > 0) {
      await this.saveState();
      this.emit('batchStarted', { items: batch, batchSize: batch.length });
    }

    return batch;
  }

  async markCompleted(itemIds) {
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    let completedCount = 0;

    for (const id of ids) {
      if (this.queues.processing.has(id)) {
        this.queues.processing.delete(id);
        this.queues.completed.add(id);
        this.stats.totalProcessed++;
        completedCount++;
      }
    }

    if (completedCount > 0) {
      await this.saveState();
      this.emit('completed', { count: completedCount, totalProcessed: this.stats.totalProcessed });
    }

    return completedCount;
  }

  async markFailed(itemIds, error = null) {
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    let failedCount = 0;

    for (const id of ids) {
      if (this.queues.processing.has(id)) {
        this.queues.processing.delete(id);
        
        const item = this.findItemById(id);
        if (item) {
          if (item.attempts >= 3) {
            this.queues.failed.push({
              ...item,
              failedAt: new Date().toISOString(),
              error: error?.message || 'Unknown error'
            });
            this.stats.totalFailed++;
            failedCount++;
          } else {
            // Re-queue for retry
            item.lastAttempt = new Date().toISOString();
            this.queues.pending.push(item);
          }
        }
      }
    }

    if (failedCount > 0) {
      await this.saveState();
      this.emit('failed', { count: failedCount, totalFailed: this.stats.totalFailed });
    }

    return failedCount;
  }

  findItemById(id) {
    // Search in pending queue
    const pendingItem = this.queues.pending.find(item => item.id === id);
    if (pendingItem) return pendingItem;

    // Search in failed queue
    const failedItem = this.queues.failed.find(item => item.id === id);
    return failedItem;
  }

  async retryFailedItems() {
    const retryableItems = this.queues.failed.filter(item => item.attempts < 3);
    const retriedIds = [];

    for (const item of retryableItems) {
      this.queues.failed = this.queues.failed.filter(failed => failed.id !== item.id);
      this.queues.pending.push(item);
      retriedIds.push(item.id);
    }

    if (retriedIds.length > 0) {
      await this.saveState();
      this.emit('retried', { count: retriedIds.length, items: retriedIds });
    }

    return retriedIds.length;
  }

  getQueueStats() {
    return {
      pending: this.queues.pending.length,
      processing: this.queues.processing.size,
      completed: this.queues.completed.size,
      failed: this.queues.failed.length,
      ...this.stats,
      processingRate: this.calculateProcessingRate()
    };
  }

  calculateProcessingRate() {
    if (!this.stats.startTime) return 0;
    
    const elapsedMs = Date.now() - new Date(this.stats.startTime).getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);
    
    if (elapsedMinutes === 0) return 0;
    
    return Math.round((this.stats.totalProcessed / elapsedMinutes) * 100) / 100;
  }

  startMetricsTracking() {
    this.processingInterval = setInterval(() => {
      const stats = this.getQueueStats();
      this.emit('metrics', stats);
    }, 5000); // Update every 5 seconds
  }

  stopMetricsTracking() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async clear() {
    this.queues.pending = [];
    this.queues.processing.clear();
    this.queues.completed.clear();
    this.queues.failed = [];
    
    this.stats = {
      totalEnqueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      startTime: new Date(),
      processingRate: 0
    };

    await this.saveState();
    this.emit('cleared');
  }

  async saveState() {
    try {
      const stateDir = path.dirname(this.persistenceFile);
      await fs.mkdir(stateDir, { recursive: true });

      const state = {
        queues: {
          pending: this.queues.pending,
          processing: Array.from(this.queues.processing),
          completed: Array.from(this.queues.completed),
          failed: this.queues.failed
        },
        stats: this.stats,
        timestamp: new Date().toISOString()
      };

      await fs.writeFile(this.persistenceFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving queue state:', error);
    }
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.persistenceFile, 'utf8');
      const state = JSON.parse(data);

      if (state.queues) {
        this.queues.pending = state.queues.pending || [];
        this.queues.processing = new Set(state.queues.processing || []);
        this.queues.completed = new Set(state.queues.completed || []);
        this.queues.failed = state.queues.failed || [];
      }

      if (state.stats) {
        this.stats = state.stats;
      }

    } catch (error) {
      console.log('No existing queue state found, starting fresh');
    }
  }

  generateId() {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async destroy() {
    this.stopMetricsTracking();
    await this.saveState();
  }
}

module.exports = QueueManager;

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class StatePersistence extends EventEmitter {
  constructor(options = {}) {
    super();
    this.stateDir = options.stateDir || 'data/crawling/state';
    this.backupDir = options.backupDir || 'data/crawling/backups';
    this.autoSaveInterval = options.autoSaveInterval || 30000; // 30 seconds
    this.maxBackups = options.maxBackups || 10;
    this.compressionEnabled = options.compressionEnabled || false;
    
    this.state = {
      crawling: {},
      domains: {},
      global: {
        startTime: null,
        totalProcessed: 0,
        totalFailed: 0,
        lastUpdate: null
      }
    };
    
    this.autoSaveTimer = null;
    this.isDirty = false;
  }

  async initialize() {
    await this.ensureDirectories();
    await this.loadState();
    this.startAutoSave();
  }

  async ensureDirectories() {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  async loadState() {
    try {
      const stateFile = path.join(this.stateDir, 'crawling_state.json');
      const data = await fs.readFile(stateFile, 'utf8');
      const loadedState = JSON.parse(data);
      
      // Merge loaded state with current state structure
      this.state = {
        crawling: loadedState.crawling || {},
        domains: loadedState.domains || {},
        global: {
          ...this.state.global,
          ...loadedState.global
        }
      };
      
      this.emit('stateLoaded', { state: this.state });
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading state:', error);
      }
      this.emit('stateLoadError', { error });
    }
  }

  async saveState(force = false) {
    if (!this.isDirty && !force) return;
    
    try {
      const stateFile = path.join(this.stateDir, 'crawling_state.json');
      const tempFile = stateFile + '.tmp';
      
      // Update timestamp
      this.state.global.lastUpdate = new Date().toISOString();
      
      // Write to temp file first, then rename for atomic operation
      await fs.writeFile(tempFile, JSON.stringify(this.state, null, 2));
      await fs.rename(tempFile, stateFile);
      
      this.isDirty = false;
      this.emit('stateSaved', { state: this.state });
      
    } catch (error) {
      console.error('Error saving state:', error);
      this.emit('stateSaveError', { error });
      throw error;
    }
  }

  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(async () => {
      await this.saveState();
    }, this.autoSaveInterval);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // Crawling state management
  updateCrawlingState(domain, updates) {
    if (!this.state.crawling[domain]) {
      this.state.crawling[domain] = {
        domain,
        startTime: new Date().toISOString(),
        status: 'pending',
        stats: {
          totalDiscovered: 0,
          totalProcessed: 0,
          totalFailed: 0,
          totalSkipped: 0
        },
        config: {},
        pages: {},
        queue: [],
        errors: []
      };
    }
    
    // Merge updates
    const domainState = this.state.crawling[domain];
    Object.assign(domainState, updates);
    
    // Update global stats
    this.updateGlobalStats();
    this.markDirty();
    
    this.emit('crawlingStateUpdated', { domain, state: domainState });
  }

  addPageToCrawl(domain, pageData) {
    if (!this.state.crawling[domain]) {
      this.updateCrawlingState(domain, {});
    }
    
    const domainState = this.state.crawling[domain];
    domainState.pages[pageData.url] = {
      ...pageData,
      addedAt: new Date().toISOString()
    };
    
    domainState.stats.totalDiscovered++;
    this.updateGlobalStats();
    this.markDirty();
    
    this.emit('pageAdded', { domain, pageData });
  }

  updatePageStatus(domain, url, status, metadata = {}) {
    if (!this.state.crawling[domain] || !this.state.crawling[domain].pages[url]) {
      return;
    }
    
    const page = this.state.crawling[domain].pages[url];
    page.status = status;
    page.updatedAt = new Date().toISOString();
    Object.assign(page, metadata);
    
    // Update domain stats
    const domainState = this.state.crawling[domain];
    if (status === 'completed') {
      domainState.stats.totalProcessed++;
    } else if (status === 'failed') {
      domainState.stats.totalFailed++;
    } else if (status === 'skipped') {
      domainState.stats.totalSkipped++;
    }
    
    this.updateGlobalStats();
    this.markDirty();
    
    this.emit('pageStatusUpdated', { domain, url, status, metadata });
  }

  addError(domain, error) {
    if (!this.state.crawling[domain]) {
      this.updateCrawlingState(domain, {});
    }
    
    const domainState = this.state.crawling[domain];
    domainState.errors.push({
      timestamp: new Date().toISOString(),
      ...error
    });
    
    // Keep only last 100 errors per domain
    if (domainState.errors.length > 100) {
      domainState.errors = domainState.errors.slice(-100);
    }
    
    this.markDirty();
    this.emit('errorAdded', { domain, error });
  }

  // Domain state management
  updateDomainState(domain, updates) {
    if (!this.state.domains[domain]) {
      this.state.domains[domain] = {
        domain,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        status: 'discovered',
        config: {},
        stats: {
          totalPages: 0,
          successfulPages: 0,
          failedPages: 0,
          avgResponseTime: 0,
          totalDataSize: 0
        }
      };
    }
    
    const domainState = this.state.domains[domain];
    Object.assign(domainState, updates);
    domainState.lastSeen = new Date().toISOString();
    
    this.markDirty();
    this.emit('domainStateUpdated', { domain, state: domainState });
  }

  // Global stats management
  updateGlobalStats() {
    let totalProcessed = 0;
    let totalFailed = 0;
    
    for (const domain in this.state.crawling) {
      const domainState = this.state.crawling[domain];
      totalProcessed += domainState.stats.totalProcessed;
      totalFailed += domainState.stats.totalFailed;
    }
    
    this.state.global.totalProcessed = totalProcessed;
    this.state.global.totalFailed = totalFailed;
  }

  // Backup management
  async createBackup(label = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupLabel = label || `backup_${timestamp}`;
    const backupFile = path.join(this.backupDir, `${backupLabel}.json`);
    
    try {
      await fs.writeFile(backupFile, JSON.stringify(this.state, null, 2));
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      this.emit('backupCreated', { label: backupLabel, file: backupFile });
      return backupFile;
      
    } catch (error) {
      console.error('Error creating backup:', error);
      this.emit('backupError', { error });
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.stat(path.join(this.backupDir, file)).then(stat => stat.mtime)
        }));
      
      // Sort by modification time
      const sortedFiles = await Promise.all(
        backupFiles.map(async file => ({
          ...file,
          mtime: await file.mtime
        }))
      );
      
      sortedFiles.sort((a, b) => b.mtime - a.mtime);
      
      // Remove excess backups
      if (sortedFiles.length > this.maxBackups) {
        const filesToRemove = sortedFiles.slice(this.maxBackups);
        
        for (const file of filesToRemove) {
          await fs.unlink(file.path);
        }
        
        this.emit('backupsCleaned', { removed: filesToRemove.length });
      }
      
    } catch (error) {
      console.error('Error cleaning up backups:', error);
    }
  }

  async restoreBackup(backupFile) {
    try {
      const data = await fs.readFile(backupFile, 'utf8');
      const backupState = JSON.parse(data);
      
      // Create backup of current state before restoring
      await this.createBackup('pre_restore');
      
      this.state = backupState;
      this.markDirty();
      await this.saveState(true);
      
      this.emit('stateRestored', { backupFile, state: this.state });
      
    } catch (error) {
      console.error('Error restoring backup:', error);
      this.emit('restoreError', { error });
      throw error;
    }
  }

  // State queries
  getCrawlingState(domain) {
    return this.state.crawling[domain] || null;
  }

  getDomainState(domain) {
    return this.state.domains[domain] || null;
  }

  getAllCrawlingStates() {
    return this.state.crawling;
  }

  getAllDomainStates() {
    return this.state.domains;
  }

  getGlobalState() {
    return this.state.global;
  }

  getStats() {
    const domains = Object.keys(this.state.crawling);
    const activeDomains = domains.filter(domain => 
      this.state.crawling[domain].status === 'active'
    );
    
    return {
      global: this.state.global,
      totalDomains: domains.length,
      activeDomains: activeDomains.length,
      totalPages: Object.values(this.state.crawling)
        .reduce((sum, domain) => sum + domain.stats.totalDiscovered, 0),
      processedPages: this.state.global.totalProcessed,
      failedPages: this.state.global.totalFailed
    };
  }

  // State management
  markDirty() {
    this.isDirty = true;
  }

  async clearState() {
    // Create backup before clearing
    await this.createBackup('pre_clear');
    
    this.state = {
      crawling: {},
      domains: {},
      global: {
        startTime: null,
        totalProcessed: 0,
        totalFailed: 0,
        lastUpdate: null
      }
    };
    
    this.markDirty();
    await this.saveState(true);
    
    this.emit('stateCleared');
  }

  async clearDomainState(domain) {
    if (this.state.crawling[domain]) {
      delete this.state.crawling[domain];
    }
    
    if (this.state.domains[domain]) {
      delete this.state.domains[domain];
    }
    
    this.updateGlobalStats();
    this.markDirty();
    await this.saveState(true);
    
    this.emit('domainStateCleared', { domain });
  }

  // Export/Import functionality
  async exportState(filePath) {
    try {
      const exportData = {
        state: this.state,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
      this.emit('stateExported', { filePath });
      
    } catch (error) {
      console.error('Error exporting state:', error);
      this.emit('exportError', { error });
      throw error;
    }
  }

  async importState(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const importData = JSON.parse(data);
      
      // Create backup before importing
      await this.createBackup('pre_import');
      
      this.state = importData.state;
      this.markDirty();
      await this.saveState(true);
      
      this.emit('stateImported', { filePath, state: this.state });
      
    } catch (error) {
      console.error('Error importing state:', error);
      this.emit('importError', { error });
      throw error;
    }
  }

  async destroy() {
    this.stopAutoSave();
    await this.saveState(true);
  }
}

module.exports = StatePersistence;

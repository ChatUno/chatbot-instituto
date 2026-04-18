import React, { useState, useEffect } from 'react';
import './CrawlingConfig.css';

const CrawlingConfig = ({ onConfigChange, initialConfig = {} }) => {
  const [config, setConfig] = useState({
    crawler: {
      maxConcurrency: 5,
      maxDepth: 3,
      rateLimitDelay: 1000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 5000
    },
    queue: {
      maxQueueSize: 10000,
      batchSize: 100
    },
    discovery: {
      maxLinksPerPage: 200,
      excludePatterns: [
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz)$/i,
        /\/api\//i,
        /\/admin\//i,
        /\/login/i,
        /\/logout/i
      ]
    },
    rateLimiter: {
      defaultDelay: 1000,
      maxDelay: 10000,
      minDelay: 100,
      adaptiveMode: true,
      errorThreshold: 3,
      successThreshold: 10
    },
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true
    },
    duplicate: {
      similarityThreshold: 0.85,
      maxCacheSize: 100000,
      enableContentHashing: true,
      enableUrlNormalization: true,
      enableTitleMatching: true
    },
    reporting: {
      realTimeUpdates: true,
      includeScreenshots: false,
      maxReportHistory: 50
    }
  });

  useEffect(() => {
    const mergedConfig = { ...config, ...initialConfig };
    setConfig(mergedConfig);
  }, [initialConfig]);

  const handleConfigChange = (section, field, value) => {
    const newConfig = {
      ...config,
      [section]: {
        ...config[section],
        [field]: value
      }
    };
    setConfig(newConfig);
    onConfigChange && onConfigChange(newConfig);
  };

  const addExcludePattern = () => {
    const newPattern = prompt('Enter exclude pattern (regex):');
    if (newPattern) {
      try {
        new RegExp(newPattern);
        handleConfigChange('discovery', 'excludePatterns', [
          ...config.discovery.excludePatterns,
          newPattern
        ]);
      } catch (error) {
        alert('Invalid regex pattern');
      }
    }
  };

  const removeExcludePattern = (index) => {
    const newPatterns = config.discovery.excludePatterns.filter((_, i) => i !== index);
    handleConfigChange('discovery', 'excludePatterns', newPatterns);
  };

  const resetToDefaults = () => {
    const defaultConfig = {
      crawler: {
        maxConcurrency: 5,
        maxDepth: 3,
        rateLimitDelay: 1000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 5000
      },
      queue: {
        maxQueueSize: 10000,
        batchSize: 100
      },
      discovery: {
        maxLinksPerPage: 200,
        excludePatterns: [
          /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz)$/i,
          /\/api\//i,
          /\/admin\//i,
          /\/login/i,
          /\/logout/i
        ]
      },
      rateLimiter: {
        defaultDelay: 1000,
        maxDelay: 10000,
        minDelay: 100,
        adaptiveMode: true,
        errorThreshold: 3,
        successThreshold: 10
      },
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
        jitter: true
      },
      duplicate: {
        similarityThreshold: 0.85,
        maxCacheSize: 100000,
        enableContentHashing: true,
        enableUrlNormalization: true,
        enableTitleMatching: true
      },
      reporting: {
        realTimeUpdates: true,
        includeScreenshots: false,
        maxReportHistory: 50
      }
    };
    setConfig(defaultConfig);
    onConfigChange && onConfigChange(defaultConfig);
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'crawling-config.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importConfig = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedConfig = JSON.parse(e.target.result);
          setConfig(importedConfig);
          onConfigChange && onConfigChange(importedConfig);
        } catch (error) {
          alert('Invalid configuration file');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="crawling-config">
      <div className="config-header">
        <h2>Crawling Configuration</h2>
        <div className="config-actions">
          <button onClick={resetToDefaults} className="btn btn-secondary">
            Reset to Defaults
          </button>
          <button onClick={exportConfig} className="btn btn-secondary">
            Export Config
          </button>
          <label className="btn btn-secondary">
            Import Config
            <input
              type="file"
              accept=".json"
              onChange={importConfig}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <div className="config-sections">
        {/* Crawler Configuration */}
        <div className="config-section">
          <h3>Crawler Settings</h3>
          <div className="config-grid">
            <div className="config-field">
              <label>Max Concurrency:</label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.crawler.maxConcurrency}
                onChange={(e) => handleConfigChange('crawler', 'maxConcurrency', parseInt(e.target.value))}
              />
              <small>Number of parallel crawling threads</small>
            </div>
            
            <div className="config-field">
              <label>Max Depth:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.crawler.maxDepth}
                onChange={(e) => handleConfigChange('crawler', 'maxDepth', parseInt(e.target.value))}
              />
              <small>Maximum link depth to follow</small>
            </div>
            
            <div className="config-field">
              <label>Rate Limit Delay (ms):</label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={config.crawler.rateLimitDelay}
                onChange={(e) => handleConfigChange('crawler', 'rateLimitDelay', parseInt(e.target.value))}
              />
              <small>Delay between requests</small>
            </div>
            
            <div className="config-field">
              <label>Timeout (ms):</label>
              <input
                type="number"
                min="5000"
                max="120000"
                step="1000"
                value={config.crawler.timeout}
                onChange={(e) => handleConfigChange('crawler', 'timeout', parseInt(e.target.value))}
              />
              <small>Request timeout</small>
            </div>
            
            <div className="config-field">
              <label>Retry Attempts:</label>
              <input
                type="number"
                min="0"
                max="10"
                value={config.crawler.retryAttempts}
                onChange={(e) => handleConfigChange('crawler', 'retryAttempts', parseInt(e.target.value))}
              />
              <small>Number of retry attempts</small>
            </div>
            
            <div className="config-field full-width">
              <label>User Agent:</label>
              <input
                type="text"
                value={config.crawler.userAgent}
                onChange={(e) => handleConfigChange('crawler', 'userAgent', e.target.value)}
              />
              <small>Browser user agent string</small>
            </div>
          </div>
        </div>

        {/* Queue Configuration */}
        <div className="config-section">
          <h3>Queue Settings</h3>
          <div className="config-grid">
            <div className="config-field">
              <label>Max Queue Size:</label>
              <input
                type="number"
                min="100"
                max="100000"
                step="100"
                value={config.queue.maxQueueSize}
                onChange={(e) => handleConfigChange('queue', 'maxQueueSize', parseInt(e.target.value))}
              />
              <small>Maximum queue size</small>
            </div>
            
            <div className="config-field">
              <label>Batch Size:</label>
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={config.queue.batchSize}
                onChange={(e) => handleConfigChange('queue', 'batchSize', parseInt(e.target.value))}
              />
              <small>Processing batch size</small>
            </div>
          </div>
        </div>

        {/* Discovery Configuration */}
        <div className="config-section">
          <h3>Link Discovery Settings</h3>
          <div className="config-grid">
            <div className="config-field">
              <label>Max Links per Page:</label>
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={config.discovery.maxLinksPerPage}
                onChange={(e) => handleConfigChange('discovery', 'maxLinksPerPage', parseInt(e.target.value))}
              />
              <small>Maximum links to extract per page</small>
            </div>
            
            <div className="config-field full-width">
              <label>Exclude Patterns:</label>
              <div className="patterns-list">
                {config.discovery.excludePatterns.map((pattern, index) => (
                  <div key={index} className="pattern-item">
                    <code>{pattern.toString()}</code>
                    <button
                      onClick={() => removeExcludePattern(index)}
                      className="btn btn-danger btn-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button onClick={addExcludePattern} className="btn btn-secondary btn-sm">
                  Add Pattern
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limiter Configuration */}
        <div className="config-section">
          <h3>Rate Limiter Settings</h3>
          <div className="config-grid">
            <div className="config-field">
              <label>Default Delay (ms):</label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={config.rateLimiter.defaultDelay}
                onChange={(e) => handleConfigChange('rateLimiter', 'defaultDelay', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>Max Delay (ms):</label>
              <input
                type="number"
                min="1000"
                max="60000"
                step="1000"
                value={config.rateLimiter.maxDelay}
                onChange={(e) => handleConfigChange('rateLimiter', 'maxDelay', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>Min Delay (ms):</label>
              <input
                type="number"
                min="50"
                max="5000"
                step="50"
                value={config.rateLimiter.minDelay}
                onChange={(e) => handleConfigChange('rateLimiter', 'minDelay', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>Error Threshold:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.rateLimiter.errorThreshold}
                onChange={(e) => handleConfigChange('rateLimiter', 'errorThreshold', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>Success Threshold:</label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.rateLimiter.successThreshold}
                onChange={(e) => handleConfigChange('rateLimiter', 'successThreshold', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>
                <input
                  type="checkbox"
                  checked={config.rateLimiter.adaptiveMode}
                  onChange={(e) => handleConfigChange('rateLimiter', 'adaptiveMode', e.target.checked)}
                />
                Adaptive Mode
              </label>
            </div>
          </div>
        </div>

        {/* Retry Configuration */}
        <div className="config-section">
          <h3>Retry Settings</h3>
          <div className="config-grid">
            <div className="config-field">
              <label>Max Attempts:</label>
              <input
                type="number"
                min="0"
                max="10"
                value={config.retry.maxAttempts}
                onChange={(e) => handleConfigChange('retry', 'maxAttempts', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>Base Delay (ms):</label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={config.retry.baseDelay}
                onChange={(e) => handleConfigChange('retry', 'baseDelay', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>Max Delay (ms):</label>
              <input
                type="number"
                min="1000"
                max="300000"
                step="1000"
                value={config.retry.maxDelay}
                onChange={(e) => handleConfigChange('retry', 'maxDelay', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>Backoff Factor:</label>
              <input
                type="number"
                min="1.1"
                max="5"
                step="0.1"
                value={config.retry.backoffFactor}
                onChange={(e) => handleConfigChange('retry', 'backoffFactor', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>
                <input
                  type="checkbox"
                  checked={config.retry.jitter}
                  onChange={(e) => handleConfigChange('retry', 'jitter', e.target.checked)}
                />
                Enable Jitter
              </label>
            </div>
          </div>
        </div>

        {/* Duplicate Detection Configuration */}
        <div className="config-section">
          <h3>Duplicate Detection Settings</h3>
          <div className="config-grid">
            <div className="config-field">
              <label>Similarity Threshold:</label>
              <input
                type="number"
                min="0.1"
                max="1.0"
                step="0.05"
                value={config.duplicate.similarityThreshold}
                onChange={(e) => handleConfigChange('duplicate', 'similarityThreshold', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>Max Cache Size:</label>
              <input
                type="number"
                min="1000"
                max="1000000"
                step="1000"
                value={config.duplicate.maxCacheSize}
                onChange={(e) => handleConfigChange('duplicate', 'maxCacheSize', parseInt(e.target.value))}
              />
            </div>
            
            <div className="config-field">
              <label>
                <input
                  type="checkbox"
                  checked={config.duplicate.enableContentHashing}
                  onChange={(e) => handleConfigChange('duplicate', 'enableContentHashing', e.target.checked)}
                />
                Content Hashing
              </label>
            </div>
            
            <div className="config-field">
              <label>
                <input
                  type="checkbox"
                  checked={config.duplicate.enableUrlNormalization}
                  onChange={(e) => handleConfigChange('duplicate', 'enableUrlNormalization', e.target.checked)}
                />
                URL Normalization
              </label>
            </div>
            
            <div className="config-field">
              <label>
                <input
                  type="checkbox"
                  checked={config.duplicate.enableTitleMatching}
                  onChange={(e) => handleConfigChange('duplicate', 'enableTitleMatching', e.target.checked)}
                />
                Title Matching
              </label>
            </div>
          </div>
        </div>

        {/* Reporting Configuration */}
        <div className="config-section">
          <h3>Reporting Settings</h3>
          <div className="config-grid">
            <div className="config-field">
              <label>
                <input
                  type="checkbox"
                  checked={config.reporting.realTimeUpdates}
                  onChange={(e) => handleConfigChange('reporting', 'realTimeUpdates', e.target.checked)}
                />
                Real-time Updates
              </label>
            </div>
            
            <div className="config-field">
              <label>
                <input
                  type="checkbox"
                  checked={config.reporting.includeScreenshots}
                  onChange={(e) => handleConfigChange('reporting', 'includeScreenshots', e.target.checked)}
                />
                Include Screenshots
              </label>
            </div>
            
            <div className="config-field">
              <label>Max Report History:</label>
              <input
                type="number"
                min="10"
                max="100"
                value={config.reporting.maxReportHistory}
                onChange={(e) => handleConfigChange('reporting', 'maxReportHistory', parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrawlingConfig;

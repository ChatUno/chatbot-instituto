import React, { useState, useEffect, useRef } from 'react';
import './CrawlingDashboard.css';

const CrawlingDashboard = ({ sessionId, onSessionEnd }) => {
  const [sessionData, setSessionData] = useState(null);
  const [stats, setStats] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [reportStats, setReportStats] = useState(null);
  const [pages, setPages] = useState([]);
  const [errors, setErrors] = useState([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (sessionId && autoRefresh) {
      startRealTimeUpdates();
    } else {
      stopRealTimeUpdates();
    }

    return () => stopRealTimeUpdates();
  }, [sessionId, autoRefresh, refreshInterval]);

  const startRealTimeUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Initial fetch
    fetchSessionData();

    // Set up interval
    intervalRef.current = setInterval(fetchSessionData, refreshInterval);
  };

  const stopRealTimeUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/massive-crawler/status/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setSessionData(data);
        setStats(data.stats);
        setQueueStats(data.queueStats);
        setReportStats(data.reportStats);

        // Check if session is completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          stopRealTimeUpdates();
          if (onSessionEnd) {
            onSessionEnd(data);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
  };

  const fetchPages = async (page = 1, status = 'all', category = 'all') => {
    try {
      const response = await fetch(
        `/api/massive-crawler/pages/${sessionId}?page=${page}&limit=20&status=${status}&category=${category}`
      );
      const data = await response.json();

      if (data.success) {
        setPages(data.pages);
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
    }
  };

  const fetchErrors = async (page = 1) => {
    try {
      const response = await fetch(
        `/api/massive-crawler/errors/${sessionId}?page=${page}&limit=20`
      );
      const data = await response.json();

      if (data.success) {
        setErrors(data.errors);
      }
    } catch (error) {
      console.error('Error fetching errors:', error);
    }
  };

  const stopCrawling = async () => {
    try {
      const response = await fetch(`/api/massive-crawler/stop/${sessionId}`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        stopRealTimeUpdates();
        setSessionData(prev => ({ ...prev, status: 'stopped' }));
      }
    } catch (error) {
      console.error('Error stopping crawling:', error);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#28a745';
      case 'completed': return '#007bff';
      case 'failed': return '#dc3545';
      case 'stopped': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'homepage': return '🏠';
      case 'navigation': return '🧭';
      case 'content': return '📄';
      case 'documents': return '📁';
      case 'media': return '🖼️';
      case 'forms': return '📝';
      default: return '🔗';
    }
  };

  if (!sessionData) {
    return (
      <div className="crawling-dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading crawling session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="crawling-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="session-info">
          <h1>Crawling Dashboard</h1>
          <div className="session-details">
            <span className="session-id">Session: {sessionId}</span>
            <span 
              className="status-badge"
              style={{ backgroundColor: getStatusColor(sessionData.status) }}
            >
              {sessionData.status.toUpperCase()}
            </span>
          </div>
        </div>
        
        <div className="dashboard-controls">
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto Refresh
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              disabled={!autoRefresh}
            >
              <option value={1000}>1s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
          </div>
          
          {sessionData.status === 'running' && (
            <button onClick={stopCrawling} className="btn btn-danger">
              Stop Crawling
            </button>
          )}
        </div>
      </div>

      {/* Main Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🔍</div>
          <div className="stat-content">
            <h3>{stats?.totalDiscovered || 0}</h3>
            <p>Pages Discovered</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{stats?.totalProcessed || 0}</h3>
            <p>Pages Processed</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <h3>{stats?.totalFailed || 0}</h3>
            <p>Pages Failed</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h3>{stats?.processingRate || 0}</h3>
            <p>Pages/Min</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{queueStats?.pending || 0}</h3>
            <p>Queue Size</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <h3>{queueStats?.processing || 0}</h3>
            <p>Processing</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <h3>Overall Progress</h3>
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{
                width: `${stats?.totalDiscovered > 0 ? (stats?.totalProcessed / stats?.totalDiscovered) * 100 : 0}%`
              }}
            ></div>
          </div>
          <div className="progress-text">
            {stats?.totalDiscovered > 0 
              ? `${Math.round((stats?.totalProcessed / stats?.totalDiscovered) * 100)}%`
              : '0%'
            }
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>Processing Rate</h3>
          <div className="mini-chart">
            <div className="chart-bars">
              {/* This would be replaced with actual chart library */}
              <div className="chart-bar" style={{ height: '60%' }}></div>
              <div className="chart-bar" style={{ height: '80%' }}></div>
              <div className="chart-bar" style={{ height: '45%' }}></div>
              <div className="chart-bar" style={{ height: '90%' }}></div>
              <div className="chart-bar" style={{ height: '70%' }}></div>
              <div className="chart-bar" style={{ height: '85%' }}></div>
            </div>
          </div>
        </div>
        
        <div className="chart-container">
          <h3>Category Distribution</h3>
          <div className="category-distribution">
            {reportStats?.categories && Object.entries(reportStats.categories).map(([category, count]) => (
              <div key={category} className="category-item">
                <span className="category-icon">{getCategoryIcon(category)}</span>
                <span className="category-name">{category}</span>
                <span className="category-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-section">
        <div className="tab-navigation">
          <button 
            className={`tab-button ${pages.length > 0 ? 'active' : ''}`}
            onClick={() => fetchPages()}
          >
            Pages
          </button>
          <button 
            className={`tab-button ${errors.length > 0 ? 'active' : ''}`}
            onClick={() => fetchErrors()}
          >
            Errors
          </button>
          <button className="tab-button">Statistics</button>
          <button className="tab-button">Settings</button>
        </div>

        <div className="tab-content">
          {/* Pages Tab */}
          {pages.length > 0 && (
            <div className="tab-pane active">
              <div className="table-container">
                <table className="pages-table">
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Category</th>
                      <th>Response Time</th>
                      <th>Depth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.slice(0, 10).map((page, index) => (
                      <tr key={index}>
                        <td className="url-cell">
                          <a href={page.url} target="_blank" rel="noopener noreferrer">
                            {page.url}
                          </a>
                        </td>
                        <td className="title-cell">{page.title}</td>
                        <td>
                          <span className={`status-badge status-${page.status}`}>
                            {page.status}
                          </span>
                        </td>
                        <td>
                          <span className="category-badge">
                            {getCategoryIcon(page.category)} {page.category}
                          </span>
                        </td>
                        <td>{page.responseTime}ms</td>
                        <td>{page.depth}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors Tab */}
          {errors.length > 0 && (
            <div className="tab-pane active">
              <div className="table-container">
                <table className="errors-table">
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Error</th>
                      <th>Status Code</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.slice(0, 10).map((error, index) => (
                      <tr key={index}>
                        <td className="url-cell">
                          <a href={error.url} target="_blank" rel="noopener noreferrer">
                            {error.url}
                          </a>
                        </td>
                        <td className="error-cell">{error.error.message}</td>
                        <td>{error.error.statusCode || '-'}</td>
                        <td>{new Date(error.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Info */}
      <div className="session-info-section">
        <h3>Session Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Start Time:</label>
            <span>{new Date(sessionData.startTime).toLocaleString()}</span>
          </div>
          <div className="info-item">
            <label>Duration:</label>
            <span>{formatDuration(Date.now() - new Date(sessionData.startTime).getTime())}</span>
          </div>
          <div className="info-item">
            <label>Success Rate:</label>
            <span>
              {stats?.totalProcessed > 0 
                ? `${Math.round((stats?.totalProcessed / (stats?.totalProcessed + stats?.totalFailed)) * 100)}%`
                : '0%'
              }
            </span>
          </div>
          <div className="info-item">
            <label>Queue Efficiency:</label>
            <span>{queueStats?.processingRate || 0} items/min</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrawlingDashboard;

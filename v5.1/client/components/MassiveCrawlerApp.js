import React, { useState, useEffect } from 'react';
import CrawlingConfig from './CrawlingConfig';
import CrawlingDashboard from './CrawlingDashboard';
import './MassiveCrawlerApp.css';

const MassiveCrawlerApp = () => {
  const [currentView, setCurrentView] = useState('config');
  const [sessionId, setSessionId] = useState(null);
  const [config, setConfig] = useState({});
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/massive-crawler/sessions');
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const startCrawling = async (url) => {
    if (!url || !url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/massive-crawler/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url.trim(),
          options: config
        })
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.sessionId);
        setCurrentView('dashboard');
        await fetchSessions(); // Refresh sessions list
      } else {
        setError(data.error || 'Failed to start crawling');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSessionEnd = (sessionData) => {
    console.log('Session ended:', sessionData);
    // Could show completion modal or notification
  };

  const switchToSession = (sessionId) => {
    setSessionId(sessionId);
    setCurrentView('dashboard');
  };

  const deleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const response = await fetch(`/api/massive-crawler/session/${sessionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        await fetchSessions();
        if (sessionId === sessionData.sessionId) {
          setSessionId(null);
          setCurrentView('config');
        }
      } else {
        setError(data.error || 'Failed to delete session');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    }
  };

  const resetToConfig = () => {
    setSessionId(null);
    setCurrentView('config');
    setError(null);
  };

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const [url, setUrl] = useState('');

  return (
    <div className="massive-crawler-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>Visual RAG Pro - Massive Crawler</h1>
          <p>V5.2-01: Intelligent Website Crawling System</p>
        </div>
        
        <nav className="header-nav">
          <button
            className={`nav-button ${currentView === 'config' ? 'active' : ''}`}
            onClick={() => setCurrentView('config')}
          >
            Configuration
          </button>
          <button
            className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => sessionId && setCurrentView('dashboard')}
            disabled={!sessionId}
          >
            Dashboard
          </button>
          <button
            className={`nav-button ${showSessions ? 'active' : ''}`}
            onClick={() => setShowSessions(!showSessions)}
          >
            Sessions ({sessions.length})
          </button>
        </nav>
      </header>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button className="error-close" onClick={() => setError(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="app-main">
        {/* Configuration View */}
        {currentView === 'config' && (
          <div className="config-view">
            <div className="url-input-section">
              <h2>Start Massive Crawling</h2>
              <div className="url-input-container">
                <input
                  type="text"
                  placeholder="Enter website URL (e.g., https://example.com)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={`url-input ${url && !validateUrl(url) ? 'invalid' : ''}`}
                  onKeyPress={(e) => e.key === 'Enter' && startCrawling(url)}
                />
                <button
                  onClick={() => startCrawling(url)}
                  disabled={!url || !validateUrl(url) || isStarting}
                  className="start-button"
                >
                  {isStarting ? 'Starting...' : 'Start Crawling'}
                </button>
              </div>
              {url && !validateUrl(url) && (
                <p className="url-error">Please enter a valid URL (e.g., https://example.com)</p>
              )}
            </div>

            <CrawlingConfig 
              onConfigChange={setConfig}
              initialConfig={config}
            />
          </div>
        )}

        {/* Dashboard View */}
        {currentView === 'dashboard' && sessionId && (
          <div className="dashboard-view">
            <div className="dashboard-header">
              <button onClick={resetToConfig} className="back-button">
                ← Back to Configuration
              </button>
              <div className="session-info">
                <span className="session-id-display">Session: {sessionId}</span>
              </div>
            </div>
            
            <CrawlingDashboard
              sessionId={sessionId}
              onSessionEnd={handleSessionEnd}
            />
          </div>
        )}

        {/* Sessions List */}
        {showSessions && (
          <div className="sessions-overlay">
            <div className="sessions-modal">
              <div className="sessions-header">
                <h2>Crawling Sessions</h2>
                <button 
                  className="close-button"
                  onClick={() => setShowSessions(false)}
                >
                  ✕
                </button>
              </div>
              
              <div className="sessions-list">
                {sessions.length === 0 ? (
                  <p className="no-sessions">No crawling sessions found</p>
                ) : (
                  sessions.map((session) => (
                    <div key={session.id} className="session-item">
                      <div className="session-info">
                        <h4>{session.url}</h4>
                        <p>Status: <span className={`status ${session.status}`}>{session.status}</span></p>
                        <p>Started: {new Date(session.startTime).toLocaleString()}</p>
                        {session.stats && (
                          <div className="session-stats">
                            <span>Discovered: {session.stats.totalDiscovered}</span>
                            <span>Processed: {session.stats.totalProcessed}</span>
                            <span>Failed: {session.stats.totalFailed}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="session-actions">
                        {session.status === 'running' && (
                          <button
                            onClick={() => switchToSession(session.id)}
                            className="view-button"
                          >
                            View Dashboard
                          </button>
                        )}
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Visual RAG Pro V5.2-01 - Massive Website Crawling System</p>
        <p>Intelligent crawling with adaptive rate limiting, duplicate detection, and real-time monitoring</p>
      </footer>
    </div>
  );
};

export default MassiveCrawlerApp;

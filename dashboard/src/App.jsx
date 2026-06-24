import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Settings, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  RefreshCw, 
  Trash2, 
  Flame, 
  Wind,
  Bell
} from 'lucide-react';

function App() {
  // Config States
  const [ipAddress, setIpAddress] = useState(() => {
    return localStorage.getItem('esp32_ip') || '192.168.1.100';
  });
  const [inputIp, setInputIp] = useState(ipAddress);
  const [showConfig, setShowConfig] = useState(false);
  const [fetchInterval, setFetchInterval] = useState(1000); // ms

  // Connection & Data States
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connected' | 'disconnected' | 'reconnecting'
  const [gasData, setGasData] = useState({
    methane: 0,
    ammonia: 0,
    isDangerous: false,
    status: 'Disconnected'
  });
  
  // Historical Trend States
  const [history, setHistory] = useState([]);
  const [eventLogs, setEventLogs] = useState([
    {
      id: 'init',
      time: new Date().toLocaleTimeString(),
      message: 'System started. Configure ESP32 IP to begin monitoring.',
      type: 'info'
    }
  ]);

  // Session Statistics
  const [stats, setStats] = useState({
    methaneMax: 0,
    methaneMin: 9999,
    ammoniaMax: 0,
    ammoniaMin: 9999
  });

  // Track previous danger state to detect transitions
  const prevDangerousRef = useRef(false);
  const consecutiveFailures = useRef(0);

  // Helper to add log messages
  const addLog = (message, type = 'info') => {
    const newLog = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      message,
      type
    };
    setEventLogs(prev => [newLog, ...prev.slice(0, 49)]); // Limit to 50 logs
  };

  // Save IP Address
  const handleSaveConfig = (e) => {
    e.preventDefault();
    // Validate IP address format (simple check)
    const cleanedIp = inputIp.trim().replace(/^https?:\/\//, '');
    localStorage.setItem('esp32_ip', cleanedIp);
    setIpAddress(cleanedIp);
    setShowConfig(false);
    consecutiveFailures.current = 0;
    setConnectionStatus('reconnecting');
    addLog(`IP address changed to ${cleanedIp}. Reconnecting...`, 'info');
  };

  // Clear Event Logs
  const handleClearLogs = () => {
    setEventLogs([
      {
        id: 'clear',
        time: new Date().toLocaleTimeString(),
        message: 'Event logs cleared by user.',
        type: 'info'
      }
    ]);
  };

  // Reset Session Statistics
  const handleResetStats = () => {
    setStats({
      methaneMax: gasData.methane,
      methaneMin: gasData.methane,
      ammoniaMax: gasData.ammonia,
      ammoniaMin: gasData.ammonia
    });
    addLog('Session min/max statistics reset.', 'info');
  };

  // Data Polling Loop
  useEffect(() => {
    let active = true;
    let timerId = null;

    const fetchData = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s timeout

      try {
        const response = await fetch(`http://${ipAddress}/data`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        
        if (!active) return;

        // Successful connection
        consecutiveFailures.current = 0;
        
        setConnectionStatus(prev => {
          if (prev !== 'connected') {
            addLog(`Connected to ESP32 Gas Monitor at ${ipAddress}`, 'success');
          }
          return 'connected';
        });

        // Parse PPM values
        const methaneVal = Number(data.methane) || 0;
        const ammoniaVal = Number(data.ammonia) || 0;
        const isDangerousVal = Boolean(data.isDangerous);

        setGasData({
          methane: methaneVal,
          ammonia: ammoniaVal,
          isDangerous: isDangerousVal,
          status: data.status || 'Active'
        });

        // Update Statistics
        setStats(prev => ({
          methaneMax: Math.max(prev.methaneMax, methaneVal),
          methaneMin: prev.methaneMin === 9999 ? methaneVal : Math.min(prev.methaneMin, methaneVal),
          ammoniaMax: Math.max(prev.ammoniaMax, ammoniaVal),
          ammoniaMin: prev.ammoniaMin === 9999 ? ammoniaVal : Math.min(prev.ammoniaMin, ammoniaVal)
        }));

        // Update History
        setHistory(prev => {
          const newHistory = [...prev, {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            methane: methaneVal,
            ammonia: ammoniaVal
          }];
          if (newHistory.length > 30) {
            newHistory.shift();
          }
          return newHistory;
        });

        // Detect Alert transitions
        if (isDangerousVal && !prevDangerousRef.current) {
          addLog(`CRITICAL ALERT: Hazardous gas levels exceeded! (${data.status})`, 'danger');
        } else if (!isDangerousVal && prevDangerousRef.current) {
          addLog('System Recovery: Gas levels returned to normal.', 'success');
        }
        
        // Minor warning alerts (sub-critical thresholds)
        if (!isDangerousVal) {
          if (methaneVal > 500 && methaneVal <= 1000) {
            addLog(`Elevated Methane level: ${methaneVal.toFixed(0)} ppm (Threshold: 1000 ppm)`, 'warning');
          }
          if (ammoniaVal > 150 && ammoniaVal <= 300) {
            addLog(`Elevated Ammonia level: ${ammoniaVal.toFixed(0)} ppm (Threshold: 300 ppm)`, 'warning');
          }
        }

        prevDangerousRef.current = isDangerousVal;

      } catch (err) {
        if (!active) return;
        clearTimeout(timeoutId);
        
        consecutiveFailures.current += 1;
        
        // Adjust status based on failure count
        if (consecutiveFailures.current >= 3) {
          setConnectionStatus(prev => {
            if (prev === 'connected') {
              addLog(`Connection lost to ESP32 at ${ipAddress} (3 consecutive timeouts)`, 'danger');
            }
            return 'disconnected';
          });
          setGasData(prev => ({
            ...prev,
            status: 'Disconnected'
          }));
        } else {
          setConnectionStatus('reconnecting');
        }
      }

      // Schedule next fetch
      if (active) {
        timerId = setTimeout(fetchData, fetchInterval);
      }
    };

    // Trigger immediate fetch
    fetchData();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [ipAddress, fetchInterval]);

  // Derive alert levels for UI card colors
  const getAlertLevel = (val, threshold) => {
    if (val > threshold) return 'danger';
    if (val > threshold * 0.5) return 'warning';
    return 'safe';
  };

  const methaneLevel = getAlertLevel(gasData.methane, 1000);
  const ammoniaLevel = getAlertLevel(gasData.ammonia, 300);

  // SVG Chart Coordinate calculations
  const renderSvgChart = () => {
    if (history.length < 2) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          <Activity size={20} style={{ marginRight: '8px', animation: 'spin 2s linear infinite' }} />
          <span>Waiting for real-time sensor data telemetry...</span>
        </div>
      );
    }

    const width = 1000;
    const height = 220;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Fixed scales to make comparison visual
    // Methane max: 2000 ppm, Ammonia max: 600 ppm
    const maxMethane = 2000;
    const maxAmmonia = 600;

    const pointsMethane = history.map((d, i) => {
      const x = paddingLeft + (i / (history.length - 1)) * chartWidth;
      const y = height - paddingBottom - (Math.min(d.methane, maxMethane) / maxMethane) * chartHeight;
      return { x, y };
    });

    const pointsAmmonia = history.map((d, i) => {
      const x = paddingLeft + (i / (history.length - 1)) * chartWidth;
      const y = height - paddingBottom - (Math.min(d.ammonia, maxAmmonia) / maxAmmonia) * chartHeight;
      return { x, y };
    });

    const buildPath = (points) => {
      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    };

    const buildAreaPath = (points) => {
      if (points.length === 0) return '';
      const startX = points[0].x;
      const endX = points[points.length - 1].x;
      const baseY = height - paddingBottom;
      return `${buildPath(points)} L ${endX.toFixed(1)} ${baseY} L ${startX.toFixed(1)} ${baseY} Z`;
    };

    // Safe thresholds in chart coordinates
    const methaneThresholdY = height - paddingBottom - (1000 / maxMethane) * chartHeight;
    const ammoniaThresholdY = height - paddingBottom - (300 / maxAmmonia) * chartHeight;

    // Generate Grid Lines (4 horizontal lines)
    const gridYValues = [0.25, 0.5, 0.75, 1];

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        <defs>
          <linearGradient id="gradient-methane" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient-ammonia" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridYValues.map((ratio, index) => {
          const y = height - paddingBottom - ratio * chartHeight;
          return (
            <g key={index}>
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                className="chart-grid-line" 
              />
              <text 
                x={paddingLeft - 10} 
                y={y + 4} 
                textAnchor="end" 
                className="chart-label-text"
              >
                {/* Left labels (Methane) */}
                {(ratio * maxMethane).toFixed(0)}
              </text>
              <text 
                x={width - paddingRight + 5} 
                y={y + 4} 
                textAnchor="start" 
                className="chart-label-text"
              >
                {/* Right labels (Ammonia) */}
                {(ratio * maxAmmonia).toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Horizontal Threshold Lines */}
        <line 
          x1={paddingLeft} 
          y1={methaneThresholdY} 
          x2={width - paddingRight} 
          y2={methaneThresholdY} 
          stroke="var(--color-danger)" 
          strokeOpacity="0.3" 
          strokeWidth="1.5" 
          strokeDasharray="4 4" 
        />
        <text 
          x={paddingLeft + 10} 
          y={methaneThresholdY - 6} 
          fill="var(--color-danger)" 
          fillOpacity="0.7" 
          fontSize="9" 
          fontFamily="monospace"
        >
          CH4 LIMIT (1000 PPM)
        </text>

        <line 
          x1={paddingLeft} 
          y1={ammoniaThresholdY} 
          x2={width - paddingRight} 
          y2={ammoniaThresholdY} 
          stroke="var(--color-warning)" 
          strokeOpacity="0.3" 
          strokeWidth="1.5" 
          strokeDasharray="4 4" 
        />
        <text 
          x={width - paddingRight - 150} 
          y={ammoniaThresholdY - 6} 
          fill="var(--color-warning)" 
          fillOpacity="0.7" 
          fontSize="9" 
          fontFamily="monospace"
        >
          NH3 LIMIT (300 PPM)
        </text>

        {/* X Axis labels (time timestamps) */}
        {history.map((d, i) => {
          if (i % 5 !== 0 && i !== history.length - 1) return null;
          const x = paddingLeft + (i / (history.length - 1)) * chartWidth;
          return (
            <text 
              key={i} 
              x={x} 
              y={height - 10} 
              textAnchor="middle" 
              className="chart-label-text"
            >
              {d.time.split(' ')[0]}
            </text>
          );
        })}

        {/* Area Charts */}
        <path d={buildAreaPath(pointsMethane)} className="chart-area-methane" />
        <path d={buildAreaPath(pointsAmmonia)} className="chart-area-ammonia" />

        {/* Line Charts */}
        <path d={buildPath(pointsMethane)} className="chart-line-methane" />
        <path d={buildPath(pointsAmmonia)} className="chart-line-ammonia" />

        {/* Interactive nodes at the last point */}
        {pointsMethane.length > 0 && (
          <>
            <circle cx={pointsMethane[pointsMethane.length - 1].x} cy={pointsMethane[pointsMethane.length - 1].y} r="5" fill="var(--accent-cyan)" />
            <circle cx={pointsMethane[pointsMethane.length - 1].x} cy={pointsMethane[pointsMethane.length - 1].y} r="10" fill="none" stroke="var(--accent-cyan)" strokeOpacity="0.5" strokeWidth="1.5">
              <animate attributeName="r" values="5;12;5" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </>
        )}
        {pointsAmmonia.length > 0 && (
          <>
            <circle cx={pointsAmmonia[pointsAmmonia.length - 1].x} cy={pointsAmmonia[pointsAmmonia.length - 1].y} r="5" fill="var(--accent-purple)" />
            <circle cx={pointsAmmonia[pointsAmmonia.length - 1].x} cy={pointsAmmonia[pointsAmmonia.length - 1].y} r="10" fill="none" stroke="var(--accent-purple)" strokeOpacity="0.5" strokeWidth="1.5">
              <animate attributeName="r" values="5;12;5" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </svg>
    );
  };

  return (
    <div className="app-container">
      {/* Header Panel */}
      <header className="app-header">
        <div className="header-title-section">
          <Activity className="header-icon" size={32} />
          <div>
            <h1>HAZARDOUS GAS DETECTOR</h1>
            <div className="header-subtitle">Real-Time IoT Safety Telemetry</div>
          </div>
        </div>

        {/* Connection status and manager settings toggle */}
        <div className="connection-panel">
          <div className={`status-badge ${connectionStatus}`}>
            <span className={`status-dot ${connectionStatus === 'reconnecting' ? 'pulsing' : ''}`}></span>
            {connectionStatus === 'connected' ? 'ESP32 Online' : connectionStatus === 'reconnecting' ? 'Reconnecting' : 'ESP32 Offline'}
          </div>

          <button 
            className="ip-config-btn" 
            onClick={() => setShowConfig(!showConfig)}
            title="Configure connection settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Config Settings Form dropdown */}
      {showConfig && (
        <form className="config-dropdown" onSubmit={handleSaveConfig}>
          <h3>Connection Setup</h3>
          <div className="input-group">
            <label htmlFor="ip-input">ESP32 IP / Hostname</label>
            <input 
              id="ip-input"
              type="text" 
              value={inputIp} 
              onChange={(e) => setInputIp(e.target.value)}
              placeholder="e.g. 192.168.1.15"
              className="ip-input"
              required 
            />
          </div>
          <div className="input-group">
            <label htmlFor="poll-input">Refresh Interval ({fetchInterval / 1000}s)</label>
            <select 
              id="poll-input"
              value={fetchInterval} 
              onChange={(e) => setFetchInterval(Number(e.target.value))}
              className="ip-input"
            >
              <option value="500">Fast (500 ms)</option>
              <option value="1000">Normal (1.0 sec)</option>
              <option value="2000">Eco (2.0 sec)</option>
              <option value="5000">Slow (5.0 sec)</option>
            </select>
          </div>
          <button type="submit" className="save-btn">Connect & Save</button>
        </form>
      )}

      {/* Safety Alert Banner */}
      {gasData.isDangerous && (
        <div className="danger-banner">
          <Bell className="banner-icon" size={28} />
          <div>
            <h2>CRITICAL ALERT</h2>
            <p>{gasData.status} The buzzer is active. Please ventilate the area immediately and check safety hazards.</p>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <section className="dashboard-grid">
        {/* Methane Gas Card */}
        <div className={`sensor-card ${methaneLevel}`}>
          <div className="sensor-header">
            <div className="sensor-info">
              <span className="sensor-type">Combustible Gas</span>
              <h2 className="sensor-name">Methane (CH₄)</h2>
            </div>
            <div className="sensor-icon-wrapper">
              <Flame size={20} />
            </div>
          </div>
          
          <div className="sensor-value-display">
            <span className="sensor-value">{gasData.methane.toFixed(1)}</span>
            <span className="sensor-unit">ppm</span>
          </div>

          <div className="gauge-container">
            <div 
              className="gauge-bar" 
              style={{ width: `${Math.min((gasData.methane / 1000) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="gauge-labels">
            <span>0 ppm</span>
            <span>Limit: 1000 ppm</span>
          </div>

          <div className="sensor-stats-grid">
            <div className="stat-item">
              <span className="stat-label">Session Max</span>
              <span className="stat-value">{stats.methaneMax.toFixed(1)} ppm</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Session Min</span>
              <span className="stat-value">
                {stats.methaneMin === 9999 ? '0.0' : stats.methaneMin.toFixed(1)} ppm
              </span>
            </div>
          </div>
        </div>

        {/* Ammonia Gas Card */}
        <div className={`sensor-card ${ammoniaLevel}`}>
          <div className="sensor-header">
            <div className="sensor-info">
              <span className="sensor-type">Toxic Gas / Air Quality</span>
              <h2 className="sensor-name">Ammonia (NH₃)</h2>
            </div>
            <div className="sensor-icon-wrapper">
              <Wind size={20} />
            </div>
          </div>

          <div className="sensor-value-display">
            <span className="sensor-value">{gasData.ammonia.toFixed(1)}</span>
            <span className="sensor-unit">ppm</span>
          </div>

          <div className="gauge-container">
            <div 
              className="gauge-bar" 
              style={{ width: `${Math.min((gasData.ammonia / 300) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="gauge-labels">
            <span>0 ppm</span>
            <span>Limit: 300 ppm</span>
          </div>

          <div className="sensor-stats-grid">
            <div className="stat-item">
              <span className="stat-label">Session Max</span>
              <span className="stat-value">{stats.ammoniaMax.toFixed(1)} ppm</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Session Min</span>
              <span className="stat-value">
                {stats.ammoniaMin === 9999 ? '0.0' : stats.ammoniaMin.toFixed(1)} ppm
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SVG Historical Chart Panel */}
      <section className="chart-panel">
        <div className="chart-header">
          <h2 className="chart-title">Real-Time Level Trends</h2>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color methane"></span>
              <span>Methane (0-2000 ppm)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color ammonia"></span>
              <span>Ammonia (0-600 ppm)</span>
            </div>
            {history.length > 0 && (
              <button 
                onClick={handleResetStats}
                className="clear-log-btn" 
                style={{ marginLeft: '12px' }}
              >
                Reset Stats
              </button>
            )}
          </div>
        </div>

        <div className="svg-chart-container">
          {renderSvgChart()}
        </div>
      </section>

      {/* Event Logs Panel */}
      <section className="log-panel">
        <div className="log-header">
          <h2 className="log-title">Telemetry & Alert History</h2>
          <button className="clear-log-btn" onClick={handleClearLogs}>
            <Trash2 size={12} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
            Clear
          </button>
        </div>

        <div className="log-list">
          {eventLogs.map((log) => {
            const LogIcon = log.type === 'danger' ? AlertTriangle 
                          : log.type === 'warning' ? AlertTriangle 
                          : log.type === 'success' ? CheckCircle2 
                          : Info;
            return (
              <div key={log.id} className={`log-item ${log.type}`}>
                <LogIcon size={14} className="log-icon" />
                <span className="log-time">[{log.time}]</span>
                <span className="log-message">{log.message}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default App;

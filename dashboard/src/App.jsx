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
  Bell,
  Download,
  Play,
  ArrowRight,
  ShieldAlert,
  Server,
  HardDrive,
  Layers,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Database,
  Cpu
} from 'lucide-react';

function App() {
  // Navigation Router State
  const [view, setView] = useState('landing'); // 'landing' | 'dashboard'

  // Dynamic Theme state ('light' | 'dark')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // Config States
  const [ipAddress, setIpAddress] = useState(() => {
    return localStorage.getItem('esp32_ip') || '192.168.1.100';
  });
  const [inputIp, setInputIp] = useState(ipAddress);
  const [showConfig, setShowConfig] = useState(false);
  const [fetchInterval, setFetchInterval] = useState(1000); // ms
  const [isSimulation, setIsSimulation] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Leak Simulator State (0 - 100)
  const [leakLevel, setLeakLevel] = useState(0);

  // Connection & Data States
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); 
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
      message: 'System started. Configure ESP32 IP or enable Simulation Mode to begin monitoring.',
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

  // Interactive Chart States
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  // Track previous states to detect transitions
  const prevDangerousRef = useRef(false);
  const consecutiveFailures = useRef(0);

  // Apply theme class to document.body for variable inheritance
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  // Helper to add log messages
  const addLog = (message, type = 'info') => {
    const newLog = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      message,
      type
    };
    setEventLogs(prev => [newLog, ...prev.slice(0, 49)]); 
  };

  // Toggle Theme
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  // Toggle Simulation Mode
  const handleToggleSimulation = (e) => {
    const enabled = e.target.checked;
    setIsSimulation(enabled);
    setHistory([]);
    setStats({
      methaneMax: 0,
      methaneMin: 9999,
      ammoniaMax: 0,
      ammoniaMin: 9999
    });
    consecutiveFailures.current = 0;
    
    if (enabled) {
      setConnectionStatus('connected');
      setLeakLevel(15); // Start with moderate baseline
      addLog('Simulation Mode activated. Drag the leak slider below to test alerts.', 'success');
    } else {
      setConnectionStatus('disconnected');
      setLeakLevel(0);
      setGasData({ methane: 0, ammonia: 0, isDangerous: false, status: 'Disconnected' });
      addLog('Simulation Mode deactivated. Connecting to hardware node...', 'info');
    }
  };

  // Trigger Remote Calibration on ESP32
  const handleRemoteCalibration = async () => {
    if (isSimulation || connectionStatus !== 'connected') return;

    setIsCalibrating(true);
    addLog('Initiating remote sensor calibration on ESP32...', 'info');

    try {
      const response = await fetch(`http://${ipAddress}/calibrate`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setIsCalibrating(false);
      addLog(`Remote Calibration complete. New baselines: MQ-6 R0 = ${data.mq6R0}Ω, MQ-135 R0 = ${data.mq135R0}Ω.`, 'success');
      alert(`Calibration Successful!\nMQ-6 R0: ${data.mq6R0} Ohm\nMQ-135 R0: ${data.mq135R0} Ohm`);
    } catch (err) {
      setIsCalibrating(false);
      addLog(`Remote calibration request failed: ${err.message}`, 'danger');
      alert(`Calibration Failed: ${err.message}`);
    }
  };

  // Export Data to CSV
  const handleExportCSV = () => {
    if (history.length === 0) {
      alert('No telemetry history available to export.');
      return;
    }

    const headers = 'Timestamp,Methane (PPM),Ammonia (PPM),Danger Flag\n';
    const rows = history.map(d => {
      const isDangerousFlag = (d.methane > 1000 || d.ammonia > 300) ? 'YES' : 'NO';
      return `"${d.time}",${d.methane.toFixed(2)},${d.ammonia.toFixed(2)},${isDangerousFlag}`;
    }).join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + rows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `hazguard_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog('Telemetry history successfully exported to CSV.', 'info');
  };

  // Save IP Address
  const handleSaveConfig = (e) => {
    e.preventDefault();
    const cleanedIp = inputIp.trim().replace(/^https?:\/\//, '');
    localStorage.setItem('esp32_ip', cleanedIp);
    setIpAddress(cleanedIp);
    setShowConfig(false);
    consecutiveFailures.current = 0;
    
    if (!isSimulation) {
      setConnectionStatus('reconnecting');
      addLog(`IP address changed to ${cleanedIp}. Reconnecting...`, 'info');
    }
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

  // Leak level simulator logic
  useEffect(() => {
    if (!isSimulation || view !== 'dashboard') return;

    // Calculate PPM metrics based on simulator slider
    const simulatedMethane = (leakLevel / 100) * 1800 + (Math.random() - 0.5) * 20 + 30;
    const simulatedAmmonia = (leakLevel / 100) * 550 + (Math.random() - 0.5) * 5 + 10;

    const finalMethane = Math.max(10.0, simulatedMethane);
    const finalAmmonia = Math.max(5.0, simulatedAmmonia);

    const isMethaneHigh = finalMethane > 1000;
    const isAmmoniaHigh = finalAmmonia > 300;
    const isDangerousVal = isMethaneHigh || isAmmoniaHigh;
    const statusText = isDangerousVal ? "Danger: High gas levels detected!" : "Gas levels are normal.";

    setGasData({
      methane: finalMethane,
      ammonia: finalAmmonia,
      isDangerous: isDangerousVal,
      status: statusText
    });

    setStats(prev => ({
      methaneMax: Math.max(prev.methaneMax, finalMethane),
      methaneMin: prev.methaneMin === 9999 ? finalMethane : Math.min(prev.methaneMin, finalMethane),
      ammoniaMax: Math.max(prev.ammoniaMax, finalAmmonia),
      ammoniaMin: prev.ammoniaMin === 9999 ? finalAmmonia : Math.min(prev.ammoniaMin, finalAmmonia)
    }));

    // Trigger log updates on spike transition
    if (isDangerousVal && !prevDangerousRef.current) {
      addLog(`SIMULATION CRITICAL: Gas warning levels exceeded! (${statusText})`, 'danger');
    } else if (!isDangerousVal && prevDangerousRef.current) {
      addLog('Simulation Recovery: Gas levels returned to normal.', 'success');
    }
    prevDangerousRef.current = isDangerousVal;

  }, [leakLevel, isSimulation, view]);

  // Telemetry updates history interval tracker
  useEffect(() => {
    if (view !== 'dashboard' || (view === 'dashboard' && gasData.methane === 0 && gasData.ammonia === 0)) return;

    const historyInterval = setInterval(() => {
      setHistory(prev => {
        const newHistory = [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          methane: gasData.methane,
          ammonia: gasData.ammonia
        }];
        if (newHistory.length > 30) {
          newHistory.shift();
        }
        return newHistory;
      });
    }, fetchInterval);

    return () => clearInterval(historyInterval);
  }, [gasData.methane, gasData.ammonia, fetchInterval, view]);

  // Data Polling Loop (Only active when NOT simulating AND in dashboard view)
  useEffect(() => {
    if (isSimulation || view !== 'dashboard') return;

    let active = true;
    let timerId = null;

    const fetchData = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200); 

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

        consecutiveFailures.current = 0;
        
        setConnectionStatus(prev => {
          if (prev !== 'connected') {
            addLog(`Connected to ESP32 Gas Monitor at ${ipAddress}`, 'success');
          }
          return 'connected';
        });

        const methaneVal = Number(data.methane) || 0;
        const ammoniaVal = Number(data.ammonia) || 0;
        const isDangerousVal = Boolean(data.isDangerous);

        setGasData({
          methane: methaneVal,
          ammonia: ammoniaVal,
          isDangerous: isDangerousVal,
          status: data.status || 'Active'
        });

        // Set the leak level approximate percentage to drive the live schematic visual
        const approxLeak = Math.max((methaneVal / 1800) * 100, (ammoniaVal / 550) * 100);
        setLeakLevel(Math.min(approxLeak, 100));

        setStats(prev => ({
          methaneMax: Math.max(prev.methaneMax, methaneVal),
          methaneMin: prev.methaneMin === 9999 ? methaneVal : Math.min(prev.methaneMin, methaneVal),
          ammoniaMax: Math.max(prev.ammoniaMax, ammoniaVal),
          ammoniaMin: prev.ammoniaMin === 9999 ? ammoniaVal : Math.min(prev.ammoniaMin, ammoniaVal)
        }));

        if (isDangerousVal && !prevDangerousRef.current) {
          addLog(`CRITICAL ALERT: Hazardous gas levels exceeded! (${data.status})`, 'danger');
        } else if (!isDangerousVal && prevDangerousRef.current) {
          addLog('System Recovery: Gas levels returned to normal.', 'success');
        }

        prevDangerousRef.current = isDangerousVal;

      } catch (err) {
        if (!active) return;
        clearTimeout(timeoutId);
        
        consecutiveFailures.current += 1;
        
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

      if (active) {
        timerId = setTimeout(fetchData, fetchInterval);
      }
    };

    fetchData();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [ipAddress, fetchInterval, isSimulation, view]);

  // Derive alert levels for UI card colors
  const getAlertLevel = (val, threshold) => {
    if (val > threshold) return 'danger';
    if (val > threshold * 0.5) return 'warning';
    return 'safe';
  };

  const methaneLevel = getAlertLevel(gasData.methane, 1000);
  const ammoniaLevel = getAlertLevel(gasData.ammonia, 300);

  // SVG Chart Dimensions Setup
  const width = 1000;
  const height = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxMethane = 2000;
  const maxAmmonia = 600;

  // Handle SVG Mouse hover for Interactive Tooltip
  const handleMouseMove = (e) => {
    if (!svgRef.current || history.length < 2) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const clientPercentX = mouseX / rect.width;
    const chartPercentX = (clientPercentX * width - paddingLeft) / chartWidth;

    const index = Math.min(
      Math.max(Math.round(chartPercentX * (history.length - 1)), 0),
      history.length - 1
    );

    if (index >= 0 && index < history.length) {
      setHoveredIndex(index);
      
      const x = paddingLeft + (index / (history.length - 1)) * chartWidth;
      setTooltipPos({
        x: x > width - 180 ? x - 170 : x + 15,
        y: paddingTop + 10
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Circular SVG Gauge Renderer
  const renderCircularGauge = (value, maxValue, alertLevel) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius; // ~314.16
    const percent = Math.min((value / maxValue) * 100, 100);
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    const strokeColor = alertLevel === 'danger' ? 'var(--color-danger)'
                      : alertLevel === 'warning' ? 'var(--color-warning)'
                      : 'var(--color-safe)';

    return (
      <div className="circular-gauge-container">
        <svg width="140" height="140" className="gauge-svg">
          <circle 
            cx="70" 
            cy="70" 
            r={radius} 
            className="gauge-track"
          />
          <circle 
            cx="70" 
            cy="70" 
            r={radius} 
            className="gauge-value-arc"
            stroke={strokeColor}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="gauge-center-content">
          <span className="gauge-center-val">{value.toFixed(1)}</span>
          <span className="gauge-center-unit">ppm</span>
        </div>
      </div>
    );
  };

  // SVG Chart Coordinate calculations
  const renderSvgChart = () => {
    if (history.length < 2) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          <Activity size={20} style={{ marginRight: '8px', animation: 'spin 2s linear infinite' }} />
          <span>Waiting for telemetry stream...</span>
        </div>
      );
    }

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

    const methaneThresholdY = height - paddingBottom - (1000 / maxMethane) * chartHeight;
    const ammoniaThresholdY = height - paddingBottom - (300 / maxAmmonia) * chartHeight;

    const gridYValues = [0.25, 0.5, 0.75, 1];

    const hoveredData = hoveredIndex !== null ? history[hoveredIndex] : null;
    const hoveredMethaneY = hoveredIndex !== null ? pointsMethane[hoveredIndex].y : 0;
    const hoveredAmmoniaY = hoveredIndex !== null ? pointsAmmonia[hoveredIndex].y : 0;
    const hoveredX = hoveredIndex !== null ? pointsMethane[hoveredIndex].x : 0;

    return (
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`} 
        width="100%" 
        height="100%"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
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
                {(ratio * maxMethane).toFixed(0)}
              </text>
              <text 
                x={width - paddingRight + 5} 
                y={y + 4} 
                textAnchor="start" 
                className="chart-label-text"
              >
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

        {/* X Axis labels */}
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
              {d.time}
            </text>
          );
        })}

        {/* Area Charts */}
        <path d={buildAreaPath(pointsMethane)} className="chart-area-methane" />
        <path d={buildAreaPath(pointsAmmonia)} className="chart-area-ammonia" />

        {/* Line Charts */}
        <path d={buildPath(pointsMethane)} className="chart-line-methane" />
        <path d={buildPath(pointsAmmonia)} className="chart-line-ammonia" />

        {/* Tooltip Overlay */}
        {hoveredIndex !== null && hoveredData && (
          <g>
            <line 
              x1={hoveredX} 
              y1={paddingTop} 
              x2={hoveredX} 
              y2={height - paddingBottom} 
              className="chart-tooltip-line" 
            />

            <circle cx={hoveredX} cy={hoveredMethaneY} r="6" fill="var(--accent-cyan)" className="chart-tooltip-dot" />
            <circle cx={hoveredX} cy={hoveredAmmoniaY} r="6" fill="var(--accent-purple)" className="chart-tooltip-dot" />

            <g className="chart-tooltip-group" transform={`translate(${tooltipPos.x}, ${tooltipPos.y})`}>
              <rect width="150" height="75" className="chart-tooltip-bg" />
              <text x="12" y="20" className="chart-tooltip-text-title">Time: {hoveredData.time}</text>
              <text x="12" y="42" className="chart-tooltip-text-val">
                Methane: <tspan fill="var(--accent-cyan)" fontWeight="600">{hoveredData.methane.toFixed(1)} ppm</tspan>
              </text>
              <text x="12" y="60" className="chart-tooltip-text-val">
                Ammonia: <tspan fill="var(--accent-purple)" fontWeight="600">{hoveredData.ammonia.toFixed(1)} ppm</tspan>
              </text>
            </g>
          </g>
        )}

        <rect 
          x={paddingLeft} 
          y={paddingTop} 
          width={chartWidth} 
          height={chartHeight} 
          className="chart-interactive-overlay" 
        />
      </svg>
    );
  };

  // Interactive P&ID industrial Schematic SVG renderer
  const renderPIDSchematic = () => {
    const isMethaneDangerous = gasData.methane > 1000;
    const isAmmoniaDangerous = gasData.ammonia > 300;
    const isSystemDangerous = isMethaneDangerous || isAmmoniaDangerous;

    // Define colors dynamically based on gas metrics
    const flowColor = isSystemDangerous ? 'var(--color-danger)'
                    : (gasData.methane > 500 || gasData.ammonia > 150) ? 'var(--color-warning)'
                    : 'var(--accent-cyan)';

    const wireMethaneColor = isMethaneDangerous ? 'var(--color-danger)'
                           : (gasData.methane > 500) ? 'var(--color-warning)'
                           : 'var(--text-muted)';

    const wireAmmoniaColor = isAmmoniaDangerous ? 'var(--color-danger)'
                           : (gasData.ammonia > 150) ? 'var(--color-warning)'
                           : 'var(--text-muted)';

    return (
      <div className="pid-visualizer-container">
        <div className="pid-schematic-wrapper">
          <svg viewBox="0 0 600 240" className="pid-svg">
            <defs>
              <filter id="glow-danger" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Industrial pipeline shape */}
            <path 
              d="M 30,70 L 220,70 L 220,120 L 380,120 L 380,70 L 570,70" 
              className="pid-pipe" 
            />

            {/* Flow path overlays */}
            <path 
              d="M 30,70 L 220,70 L 220,120 L 380,120 L 380,70 L 570,70" 
              className="pid-flow-line" 
              stroke={flowColor}
              style={{ filter: isSystemDangerous ? 'url(#glow-danger)' : 'none' }}
            />

            {/* Pipeline arrows */}
            <path d="M 60,70 L 50,65 L 50,75 Z" fill={flowColor} />
            <path d="M 540,70 L 530,65 L 530,75 Z" fill={flowColor} />

            {/* MQ-6 Methane Sensor Node */}
            <g transform="translate(130, 70)">
              <rect x="-16" y="-30" width="32" height="30" rx="4" className="pid-sensor-capsule" />
              <line x1="-12" y1="-15" x2="12" y2="-15" stroke="var(--card-border)" strokeWidth="1.5" />
              <line x1="-12" y1="-10" x2="12" y2="-10" stroke="var(--card-border)" strokeWidth="1.5" />
              <text x="0" y="-36" textAnchor="middle" className="pid-node-text" fill="var(--text-primary)">MQ-6 (CH₄)</text>
              <circle cx="0" cy="-5" r="4" fill={isMethaneDangerous ? 'var(--color-danger)' : 'var(--color-safe)'} />
            </g>

            {/* MQ-135 Ammonia Sensor Node */}
            <g transform="translate(470, 70)">
              <rect x="-16" y="-30" width="32" height="30" rx="4" className="pid-sensor-capsule" />
              <line x1="-12" y1="-15" x2="12" y2="-15" stroke="var(--card-border)" strokeWidth="1.5" />
              <line x1="-12" y1="-10" x2="12" y2="-10" stroke="var(--card-border)" strokeWidth="1.5" />
              <text x="0" y="-36" textAnchor="middle" className="pid-node-text" fill="var(--text-primary)">MQ-135 (NH₃)</text>
              <circle cx="0" cy="-5" r="4" fill={isAmmoniaDangerous ? 'var(--color-danger)' : 'var(--color-safe)'} />
            </g>

            {/* ESP32 Microcontroller Node */}
            <g transform="translate(260, 160)">
              <rect width="80" height="50" rx="6" className="pid-mcu-shape" fill="var(--card-bg)" />
              <text x="40" y="22" textAnchor="middle" fontWeight="bold" fontSize="11" fill="var(--text-primary)">ESP32 MCU</text>
              <text x="40" y="38" textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="monospace">
                {isSimulation ? 'SIMULATOR' : 'HARDWARE'}
              </text>
              {/* Pin dots */}
              <circle cx="0" cy="15" r="2" fill="var(--text-muted)" />
              <circle cx="0" cy="25" r="2" fill="var(--text-muted)" />
              <circle cx="0" cy="35" r="2" fill="var(--text-muted)" />
              <circle cx="80" cy="15" r="2" fill="var(--text-muted)" />
              <circle cx="80" cy="25" r="2" fill="var(--text-muted)" />
              <circle cx="80" cy="35" r="2" fill="var(--text-muted)" />
            </g>

            {/* Active Buzzer Unit Node */}
            <g transform="translate(110, 165)">
              <circle cx="20" cy="20" r="18" fill="var(--social-bg)" stroke="var(--card-border)" strokeWidth="1.5" />
              <circle cx="20" cy="20" r="4" fill="var(--text-primary)" />
              {/* Buzzer icon / alerts */}
              <Bell 
                x="10" 
                y="10" 
                size={20} 
                className="pid-buzzer-bell" 
                style={{ 
                  color: isSystemDangerous ? 'var(--color-danger)' : 'var(--text-muted)',
                  transform: isSystemDangerous ? 'rotate(15deg) scale(1.1)' : 'none',
                  transformOrigin: '20px 20px'
                }} 
              />
              <text x="20" y="48" textAnchor="middle" className="pid-node-text">Buzzer</text>
            </g>

            {/* Signal Wires connecting everything */}
            {/* MQ-6 wire to ESP32 */}
            <path 
              d="M 130,70 L 130,185 L 260,185" 
              className="pid-wire"
              stroke={wireMethaneColor}
            />

            {/* MQ-135 wire to ESP32 */}
            <path 
              d="M 470,70 L 470,185 L 340,185" 
              className="pid-wire"
              stroke={wireAmmoniaColor}
            />

            {/* ESP32 output wire to Buzzer */}
            <path 
              d="M 260,195 L 148,195" 
              className="pid-wire"
              stroke={isSystemDangerous ? 'var(--color-danger)' : 'var(--text-muted)'}
            />

            {/* Label texts overlay */}
            <text x="50" y="105" className="pid-node-text" fill="var(--text-muted)">REFINERY PIPELINE</text>
          </svg>
        </div>

        {/* Gas leak simulation slider */}
        <div className="leak-slider-container">
          <div className="slider-header">
            <span className="slider-label">
              {isSimulation ? 'Leak Simulator Slider' : 'Live Hardware Stream'}
            </span>
            <span 
              className="slider-val-readout"
              style={{ color: isSystemDangerous ? 'var(--color-danger)' : 'var(--text-secondary)' }}
            >
              {isSimulation ? `Leak Level: ${leakLevel}%` : 'Readings Locked to ESP32'}
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={leakLevel} 
            onChange={(e) => setLeakLevel(Number(e.target.value))}
            className="leak-slider"
            disabled={!isSimulation}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            {isSimulation 
              ? 'Move the slider to simulate gas concentration spikes. Levels above 50% trigger alarms.' 
              : 'Switch to Demo/Simulation Mode in connection settings to unlock this leak slider.'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className={`app-wrapper theme-${theme}`}>
      {/* LANDING PAGE VIEW */}
      {view === 'landing' ? (
        <div className="landing-container">
          {/* Navigation Bar */}
          <header className="landing-header">
            <div className="landing-nav-wrapper">
              <a href="#home" className="landing-logo" onClick={() => window.scrollTo(0, 0)} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/hazguard_logo.jpg" alt="HazGuard Logo" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                <span className="logo-text">HAZGUARD</span>
              </a>
              
              <nav className="landing-nav-links">
                <a href="#features" className="nav-link">Features</a>
                <a href="#architecture" className="nav-link">Architecture</a>
                <a href="#specs" className="nav-link">Tech Specs</a>
                
                {/* Dynamic Theme Toggle in Navigation */}
                <button 
                  className="theme-toggle-btn"
                  onClick={toggleTheme}
                  title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                  style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                >
                  {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                </button>

                <button 
                  className="btn-primary" 
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                  onClick={() => setView('dashboard')}
                >
                  Launch Console
                  <ArrowRight size={14} />
                </button>
              </nav>
            </div>
          </header>

          {/* Split-Hero Layout displaying the 3D Industrial Asset */}
          <section id="home" className="landing-hero animate-fade-in">
            <div className="hero-content-side">
              <div className="hero-badge">Industrial Safety Telemetry</div>
              <h2 className="hero-title">Next-Gen Hazardous Gas Monitoring</h2>
              <p className="hero-desc">
                HazGuard bridges physical hardware gas sensors with high-performance dashboards, ensuring real-time monitoring, early alarm triggers, and automatic WiFi emergency fallback portals.
              </p>
              <div className="hero-ctas">
                <button className="btn-primary" onClick={() => setView('dashboard')}>
                  Launch Telemetry Console
                  <ArrowRight size={16} />
                </button>
                <a href="#features" className="btn-secondary" style={{ padding: '14px 28px', fontSize: '15px' }}>
                  Learn More
                </a>
              </div>
            </div>

            {/* Visual Side for 3D Product Image */}
            <div className="hero-image-side">
              <div className="hero-glow-element"></div>
              <img 
                src="/hazguard_sensor_3d.jpg" 
                alt="HazGuard Smart Pipeline Gas Sensor Node" 
                className="hero-3d-visual"
              />
            </div>
          </section>

          {/* Features Block Section */}
          <section id="features" className="landing-section">
            <div className="section-header">
              <span className="section-tag">Key Pillars</span>
              <h2 className="section-title">Active Prevention Systems</h2>
              <p className="section-desc">
                Designed from the ground up for reliable industrial and domestic hazard shielding.
              </p>
            </div>

            <div className="landing-features-grid">
              <div className="landing-feature-card">
                <div className="feature-icon-box">
                  <Flame size={22} />
                </div>
                <h3 className="feature-card-title">Dual-Gas Monitoring</h3>
                <p className="feature-card-desc">
                  Continuous logging of Methane (combustibles) and Ammonia (toxics) using highly-calibrated math models directly matching sensor datasheets.
                </p>
              </div>

              <div className="landing-feature-card">
                <div className="feature-icon-box">
                  <ShieldAlert size={22} />
                </div>
                <h3 className="feature-card-title">Buzzer Alert Patterns</h3>
                <p className="feature-card-desc">
                  Active alarm beeps (150ms cycles) toggle dynamically at the hardware level the instant gas PPM safety thresholds are breached.
                </p>
              </div>

              <div className="landing-feature-card">
                <div className="feature-icon-box">
                  <Wifi size={22} />
                </div>
                <h3 className="feature-card-title">Emergency AP Fallback</h3>
                <p className="feature-card-desc">
                  WiFi failure initiates a fallback mode. The ESP32 launches its own access point (**`HazGuard-Emergency-AP`**), ensuring connection is never lost.
                </p>
              </div>

              <div className="landing-feature-card">
                <div className="feature-icon-box">
                  <Download size={22} />
                </div>
                <h3 className="feature-card-title">CSV Telemetry Exporter</h3>
                <p className="feature-card-desc">
                  Export session logs containing detailed timestamps and raw level values straight to CSV file format for industrial safety reporting.
                </p>
              </div>
            </div>
          </section>

          {/* Architecture Diagram Section */}
          <section id="architecture" className="landing-section" style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="section-header">
              <span className="section-tag">Information Flow</span>
              <h2 className="section-title">System Architecture</h2>
              <p className="section-desc">
                How the physical hardware components securely relay information to the web interface.
              </p>
            </div>

            <div className="architecture-diagram">
              <div className="arch-node">
                <Wind className="arch-icon" size={24} />
                <div className="arch-node-title">1. Gas Sensors</div>
                <div className="arch-node-desc">MQ-6 & MQ-135 sensors track gaseous densities.</div>
              </div>

              <div className="arch-arrow-line"></div>

              <div className="arch-node">
                <Layers className="arch-icon" size={24} />
                <div className="arch-node-title">2. ESP32 Processing</div>
                <div className="arch-node-desc">EMA filters digital signal, computes logarithmic PPM.</div>
              </div>

              <div className="arch-arrow-line"></div>

              <div className="arch-node">
                <Server className="arch-icon" size={24} />
                <div className="arch-node-title">3. CORS API Server</div>
                <div className="arch-node-desc">ESP32 serves JSON data on `/data` route.</div>
              </div>

              <div className="arch-arrow-line"></div>

              <div className="arch-node">
                <HardDrive className="arch-icon" size={24} />
                <div className="arch-node-title">4. React Console</div>
                <div className="arch-node-desc">Client fetches metrics and updates interactive SVG charts.</div>
              </div>
            </div>
          </section>

          {/* Specs Table Section */}
          <section id="specs" className="landing-section">
            <div className="section-header">
              <span className="section-tag">Specifications</span>
              <h2 className="section-title">Technical Specifications</h2>
              <p className="section-desc">
                Hardware tolerances and network configurations.
              </p>
            </div>

          <div className="specs-table-container">
            <table className="specs-table">
              <thead>
                <tr>
                  <th>Metric / System Parameter</th>
                  <th>Configuration / Standard</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Microcontroller Node</td>
                  <td>ESP32 Dev Module (WROOM-32D)</td>
                </tr>
                <tr>
                  <td>Operating Voltage</td>
                  <td>5V DC (via USB or external header)</td>
                </tr>
                <tr>
                  <td>Average Active Current Draw</td>
                  <td>~220 mA (MQ sensor heaters require continuous power)</td>
                </tr>
                <tr>
                  <td>Methane (CH4) Sensor limits</td>
                  <td>100 PPM to 10,000 PPM (MQ-6)</td>
                </tr>
                <tr>
                  <td>Ammonia (NH3) Sensor limits</td>
                  <td>10 PPM to 300 PPM (MQ-135)</td>
                </tr>
                <tr>
                  <td>Data Polling Protocol</td>
                  <td>CORS-Enabled HTTP REST API (Port 80 JSON response)</td>
                </tr>
                <tr>
                  <td>Digital Noise Filtering</td>
                  <td>Exponential Moving Average Algorithm ($\alpha = 0.15$)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-content">
            <div className="footer-logo-desc">
              <a href="#home" className="landing-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/hazguard_logo.jpg" alt="HazGuard Logo" style={{ width: '22px', height: '22px', borderRadius: '5px' }} />
                <span className="logo-text" style={{ fontSize: '16px' }}>HAZGUARD</span>
              </a>
              <span className="footer-desc">© 2026 HazGuard IoT Systems. All rights reserved.</span>
            </div>
            
            <div className="footer-links">
              <a href="#features" className="footer-link">Features</a>
              <a href="#architecture" className="footer-link">Architecture</a>
              <a href="#specs" className="footer-link">Tech Specs</a>
              <button 
                onClick={() => setView('dashboard')} 
                className="footer-link" 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Launch Console
              </button>
            </div>
          </div>
        </footer>
      </div>
    ) : (
      /* TELEMETRY CONSOLE BENTO GRID VIEW */
      <div className="app-container">
        {/* Console Header */}
        <header className="app-header">
          <div className="header-title-section">
            <button className="console-back-btn" onClick={() => setView('landing')}>
              Back to Home
            </button>
            <div style={{ height: '24px', width: '1px', background: 'var(--card-border)' }}></div>
            <img src="/hazguard_logo.jpg" alt="HazGuard Logo" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '20px', margin: 0 }}>HAZGUARD HUB</h1>
                {gasData.isDangerous && (
                  <div className="simulation-active-badge" style={{ background: 'var(--color-danger-glow)', color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.2)' }}>
                    <span style={{ background: 'var(--color-danger)' }}></span>DANGER
                  </div>
                )}
                {isSimulation && (
                  <div className="simulation-active-badge">
                    <span></span>Simulating
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connection status and settings */}
          <div className="connection-panel">
            {/* Dynamic theme switcher inside console header */}
            <button 
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <div className={`status-badge ${isSimulation ? 'connected' : connectionStatus}`}>
              <span className={`status-dot ${(!isSimulation && connectionStatus === 'reconnecting') ? 'pulsing' : ''}`}></span>
              {isSimulation 
                ? 'Demo Mode' 
                : connectionStatus === 'connected' 
                  ? 'ESP32 Online' 
                  : connectionStatus === 'reconnecting' 
                    ? 'Reconnecting' 
                    : 'ESP32 Offline'}
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
            
            <div className="sim-mode-toggle-container">
              <div className="sim-label-wrap">
                <Play size={14} className="text-secondary" />
                <label htmlFor="sim-toggle-checkbox" style={{ fontSize: '13px', fontWeight: '600' }}>Demo/Simulation Mode</label>
              </div>
              <label className="sim-toggle-switch">
                <input 
                  id="sim-toggle-checkbox"
                  type="checkbox" 
                  checked={isSimulation} 
                  onChange={handleToggleSimulation} 
                />
                <span className="sim-toggle-slider"></span>
              </label>
            </div>

            {!isSimulation && (
              <>
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

                {connectionStatus === 'connected' && (
                  <button 
                    type="button" 
                    className="btn-secondary btn-calibrate" 
                    onClick={handleRemoteCalibration}
                    disabled={isCalibrating}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <RefreshCw size={14} className={isCalibrating ? 'animate-spin' : ''} />
                    {isCalibrating ? 'Calibrating...' : 'Recalibrate Sensors (Clean Air)'}
                  </button>
                )}
              </>
            )}

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
              <p>{gasData.status} The alarm buzzer is sounding. Please ventilate the area immediately and check safety hazards.</p>
            </div>
          </div>
        )}

        {/* ==========================================================================
           Unified Bento Grid System
           ========================================================================== */}
        <section className="bento-grid">
          
          {/* Card 1: Telemetry Gauges (Span 2) */}
          <div className="bento-card bento-card-telemetry">
            <div className="sensor-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} className="text-secondary" />
                <h2 style={{ fontSize: '16px', fontWeight: '800' }}>Active Gas Telemetry</h2>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>REAL-TIME ANALYSIS</span>
            </div>

            <div className="telemetry-split">
              {/* Methane Subcard */}
              <div className={`sensor-subcard ${methaneLevel}`}>
                <div className="sensor-header">
                  <div className="sensor-info">
                    <span className="sensor-type">Combustible Gas</span>
                    <h3 className="sensor-name">Methane (CH₄)</h3>
                  </div>
                  <div className="sensor-icon-wrapper">
                    <Flame size={18} />
                  </div>
                </div>
                
                {renderCircularGauge(gasData.methane, 1000, methaneLevel)}

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

              {/* Ammonia Subcard */}
              <div className={`sensor-subcard ${ammoniaLevel}`}>
                <div className="sensor-header">
                  <div className="sensor-info">
                    <span className="sensor-type">Toxic Gas / AQI</span>
                    <h3 className="sensor-name">Ammonia (NH₃)</h3>
                  </div>
                  <div className="sensor-icon-wrapper">
                    <Wind size={18} />
                  </div>
                </div>

                {renderCircularGauge(gasData.ammonia, 300, ammoniaLevel)}

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
            </div>
          </div>

          {/* Card 2: Interactive SVG P&ID Schematic Simulator (Span 1, Row Span 2) */}
          <div className="bento-card bento-card-visual">
            <div className="sensor-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} className="text-secondary" />
                <h2 style={{ fontSize: '16px', fontWeight: '800' }}>Schematic P&ID Flow</h2>
              </div>
            </div>

            {renderPIDSchematic()}

            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
                <img 
                  src="/hazguard_sensor_3d.jpg" 
                  alt="HazGuard 3D Node" 
                  style={{ width: '60px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--card-border)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>3D Physical Node</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Node Active at 14 BAR Pressure</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Historical Trend Charts (Span 2) */}
          <div className="bento-card bento-card-chart">
            <div className="chart-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} className="text-secondary" />
                <h2 style={{ fontSize: '16px', fontWeight: '800' }}>Real-Time Level Trends</h2>
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-color methane"></span>
                  <span>CH₄ (Methane)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color ammonia"></span>
                  <span>NH₃ (Ammonia)</span>
                </div>
              </div>
            </div>

            <div className="svg-chart-container">
              {renderSvgChart()}
            </div>
          </div>

          {/* Card 4: Historical Logs list (Span 2) */}
          <div className="bento-card bento-card-logs">
            <div className="log-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} className="text-secondary" />
                <h2 style={{ fontSize: '16px', fontWeight: '800' }}>Telemetry & Warning History</h2>
              </div>
              <button className="clear-log-btn" onClick={handleClearLogs}>
                <Trash2 size={11} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                Clear Logs
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
          </div>

          {/* Card 5: Console Exporter & Session resets (Span 1) */}
          <div className="bento-card bento-card-controls">
            <div className="sensor-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '800' }}>Console Actions</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', justifyContent: 'center' }}>
              <button 
                onClick={handleExportCSV}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                title="Export telemetry history to CSV file"
              >
                <Download size={14} />
                Export CSV Logs
              </button>
              
              <button 
                onClick={handleResetStats}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              >
                <RefreshCw size={14} />
                Reset Session stats
              </button>
            </div>
          </div>

        </section>
      </div>
    )}
    </div>
  );
}

export default App;

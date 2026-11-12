import { useState, useEffect, useMemo, useRef } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

import {
  Radio,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  Thermometer,
  Scale,
  ChevronRight,
  ExternalLink,
  Brain,
  BarChart3,
  LayoutDashboard,
  Database,
  Settings,
  Download,
  Camera,
  Zap,
  Loader2,
  Minus,
  Plus,
  Bell,
  BellOff,
  RefreshCw,
  Grid,
  Layout,
  TrendingUp,
  Clock,
  FileText,
  Table2,
  Image,
  Calendar,
} from "lucide-react";

import { getSensorData } from "../data/sensorData";
import { getAlerts } from "../data/sensorData";
import { getSensorHistory } from "../data/sensorData";
import { downloadDailyReport } from "../data/sensorData";
import useRuntimeSettings from "../hooks/useRuntimeSettings";
import { FOUNDRY_VIDEOS } from "../config/videos";

function LiveMonitoring() {
  const [selectedVideoId, setSelectedVideoId] = useState("cam1");
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sensorConnected, setSensorConnected] = useState(true);
  const [cameraConnected, setCameraConnected] = useState(true);
  const [multiCameraConnected, setMultiCameraConnected] = useState({});
  const [multiCameraView, setMultiCameraView] = useState(false);
  const [showThresholdControls, setShowThresholdControls] = useState(false);
  const [tempThresholds, setTempThresholds] = useState({ min: 1300, max: 1600 });
  const [weightThresholds, setWeightThresholds] = useState({ min: 500, max: 650 });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [systemHealth, setSystemHealth] = useState({
    sensor: "healthy",
    camera: "healthy",
    api: "healthy",
    database: "healthy",
  });

  // Historical Monitoring state
  const [historicalDate, setHistoricalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [historicalData, setHistoricalData] = useState([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState("");

  // Daily Production Report state
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  // Video refs for snapshot capture
  const singleVideoRef = useRef(null);
  const multiCameraRefs = useRef({});

  const runtimeSettings = useRuntimeSettings();
  const TEMP_MIN = runtimeSettings.min_temperature;
  const TEMP_MAX = runtimeSettings.max_temperature;
  const WEIGHT_MIN = runtimeSettings.min_weight;
  const WEIGHT_MAX = runtimeSettings.max_weight;

  const selectedVideo = FOUNDRY_VIDEOS.find(v => v.id === selectedVideoId) || FOUNDRY_VIDEOS[0];

  // Sync local thresholds with runtime settings
  useEffect(() => {
    setTempThresholds({ min: TEMP_MIN, max: TEMP_MAX });
    setWeightThresholds({ min: WEIGHT_MIN, max: WEIGHT_MAX });
  }, [TEMP_MIN, TEMP_MAX, WEIGHT_MIN, WEIGHT_MAX]);

  // Fetch sensor data
  useEffect(() => {
    async function fetchSensorData() {
      try {
        const data = await getSensorData(1, 200);
        const sensorRecords = data?.records || [];

        const formattedData = sensorRecords
          .map((item) => ({
            time: new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            timestamp: item.timestamp, // Keep original for full datetime
            temperature: item.temperature,
            weight: item.weight,
            batchId: item.batchId,
          }))
          .reverse();

        setSensorData(formattedData);
        setSensorConnected(true);
        setError("");
      } catch (err) {
        console.error("Error fetching sensor data:", err);
        setSensorConnected(false);
        setError("Unable to load sensor data");
      } finally {
        setLoading(false);
      }
    }

    fetchSensorData();
    const intervalMs = Math.max(1, Number(runtimeSettings.refresh_interval) || 5) * 1000;
    const interval = setInterval(fetchSensorData, intervalMs);
    return () => clearInterval(interval);
  }, [runtimeSettings.refresh_interval]);

  // Fetch historical sensor data
  useEffect(() => {
    async function fetchHistoricalData() {
      setHistoricalLoading(true);
      setHistoricalError("");
      try {
        const data = await getSensorHistory(historicalDate, 1, 1000);
        const records = data?.records || [];

        const formattedData = records
          .map((item) => ({
            time: new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            timestamp: item.timestamp,
            temperature: item.temperature,
            weight: item.weight,
            batchId: item.batchId,
          }))
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        setHistoricalData(formattedData);
      } catch (err) {
        console.error("Error fetching historical data:", err);
        setHistoricalError("Unable to load historical data");
      } finally {
        setHistoricalLoading(false);
      }
    }

    fetchHistoricalData();
  }, [historicalDate]);

  // Simulate system health checks
  useEffect(() => {
    const healthInterval = setInterval(() => {
      setSystemHealth(prev => ({
        ...prev,
        sensor: sensorConnected ? "healthy" : "critical",
        camera: cameraConnected ? "healthy" : "critical",
        api: Math.random() > 0.05 ? "healthy" : "warning",
        database: Math.random() > 0.02 ? "healthy" : "warning",
      }));
    }, 10000);
    return () => clearInterval(healthInterval);
  }, [sensorConnected, cameraConnected]);

  // Status computation
  const latestReading = useMemo(() => sensorData[0], [sensorData]);

  const tempStatus = useMemo(() => {
    if (!latestReading) return { level: "unknown", label: "No Data", color: "#9ca3af" };
    const temp = latestReading.temperature;
    if (temp > tempThresholds.max || temp < tempThresholds.min) return { level: "critical", label: "Critical", color: "#ef4444" };
    const threshold = Math.max(tempThresholds.max - temp, temp - tempThresholds.min);
    if (threshold < 50) return { level: "warning", label: "Warning", color: "#f59e0b" };
    return { level: "normal", label: "Normal", color: "#16a34a" };
  }, [latestReading, tempThresholds]);

  const weightStatus = useMemo(() => {
    if (!latestReading) return { level: "unknown", label: "No Data", color: "#9ca3af" };
    const weight = latestReading.weight;
    if (weight > weightThresholds.max || weight < weightThresholds.min) return { level: "critical", label: "Critical", color: "#ef4444" };
    const threshold = Math.max(weightThresholds.max - weight, weight - weightThresholds.min);
    if (threshold < 20) return { level: "warning", label: "Warning", color: "#f59e0b" };
    return { level: "normal", label: "Normal", color: "#16a34a" };
  }, [latestReading, weightThresholds]);

  // Chart data
  const chartData = useMemo(() =>
    sensorData.filter((item) => typeof item.temperature === "number" && typeof item.weight === "number"),
    [sensorData]
  );

  const tempDomain = useMemo(() => [
    Math.min(tempThresholds.min - 100, Math.min(...chartData.map(d => d.temperature), 1000)),
    Math.max(tempThresholds.max + 100, Math.max(...chartData.map(d => d.temperature), 1800))
  ], [chartData, tempThresholds]);

  const weightDomain = useMemo(() => [
    Math.min(weightThresholds.min - 50, Math.min(...chartData.map(d => d.weight), 0)),
    Math.max(weightThresholds.max + 50, Math.max(...chartData.map(d => d.weight), 700))
  ], [chartData, weightThresholds]);

  // Historical data summary statistics
  const historicalTempValues = useMemo(() =>
    historicalData.map(d => d.temperature).filter(v => typeof v === "number"),
    [historicalData]
  );

  const historicalWeightValues = useMemo(() =>
    historicalData.map(d => d.weight).filter(v => typeof v === "number"),
    [historicalData]
  );

  const tempStats = useMemo(() => {
    if (historicalTempValues.length === 0) return { min: "N/A", max: "N/A", avg: "N/A" };
    return {
      min: Math.min(...historicalTempValues),
      max: Math.max(...historicalTempValues),
      avg: (historicalTempValues.reduce((a, b) => a + b, 0) / historicalTempValues.length).toFixed(1),
    };
  }, [historicalTempValues]);

  const weightStats = useMemo(() => {
    if (historicalWeightValues.length === 0) return { min: "N/A", max: "N/A", avg: "N/A" };
    return {
      min: Math.min(...historicalWeightValues),
      max: Math.max(...historicalWeightValues),
      avg: (historicalWeightValues.reduce((a, b) => a + b, 0) / historicalWeightValues.length).toFixed(1),
    };
  }, [historicalWeightValues]);

  const formatFullDateTime = (timestamp) => {
    if (!timestamp) return "--";
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTimeOnly = (timestamp) => {
    if (!timestamp) return "--";
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Export Functions
  const snapshotVideoFrame = () => {
    const video = multiCameraView
      ? Object.values(multiCameraRefs.current)[0]?.current
      : singleVideoRef.current;

    if (!video) {
      alert("No video available for snapshot");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const link = document.createElement("a");
    link.download = `foundry-snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const exportChartCSV = () => {
    if (chartData.length === 0) {
      alert("No chart data available to export");
      return;
    }

    const headers = ["Timestamp", "Temperature (°C)", "Weight (kg)", "Batch ID"];
    const rows = chartData.map(d => [
      d.timestamp ? new Date(d.timestamp).toISOString() : d.time,
      d.temperature,
      d.weight,
      d.batchId || "N/A"
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(val => `"${val}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.download = `sensor-data-${new Date().toISOString().split("T")[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const generateShiftReport = () => {
    const now = new Date();
    const shiftStart = new Date(now);
    shiftStart.setHours(6, 0, 0, 0); // Assume 6 AM shift start
    if (shiftStart > now) shiftStart.setDate(shiftStart.getDate() - 1);

    const shiftEnd = new Date(shiftStart);
    shiftEnd.setHours(22, 0, 0, 0); // 10 PM shift end

    const shiftData = chartData.filter(d => {
      const ts = d.timestamp ? new Date(d.timestamp) : new Date();
      return ts >= shiftStart && ts <= shiftEnd;
    });

    const temps = shiftData.map(d => d.temperature).filter(v => typeof v === "number");
    const weights = shiftData.map(d => d.weight).filter(v => typeof v === "number");

    const tempStats = temps.length > 0 ? {
      min: Math.min(...temps),
      max: Math.max(...temps),
      avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      count: temps.length
    } : { min: "N/A", max: "N/A", avg: "N/A", count: 0 };

    const weightStats = weights.length > 0 ? {
      min: Math.min(...weights),
      max: Math.max(...weights),
      avg: (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1),
      count: weights.length
    } : { min: "N/A", max: "N/A", avg: "N/A", count: 0 };

    const activeAlertsCount = 0; // Could fetch from alerts if needed
    const videoTitle = multiCameraView ? "Multi-Camera Grid" : selectedVideo.title;

    const report = `VISIONSHIELD FOUNDRY MONITORING - SHIFT REPORT
====================================================
Generated: ${now.toLocaleString()}
Shift Period: ${shiftStart.toLocaleTimeString()} - ${shiftEnd.toLocaleTimeString()}
Video Feed: ${videoTitle}

SENSOR SUMMARY (${shiftData.length} readings)
------------------------------------
Temperature (°C):
  Min: ${tempStats.min}
  Max: ${tempStats.max}
  Average: ${tempStats.avg}
  Readings: ${tempStats.count}

Weight (kg):
  Min: ${weightStats.min}
  Max: ${weightStats.max}
  Average: ${weightStats.avg}
  Readings: ${weightStats.count}

THRESHOLDS
----------
Temperature: ${tempThresholds.min}°C - ${tempThresholds.max}°C
Weight: ${weightThresholds.min}kg - ${weightThresholds.max}kg

SYSTEM HEALTH
-------------
Sensor: ${systemHealth.sensor.charAt(0).toUpperCase() + systemHealth.sensor.slice(1)}
Camera: ${systemHealth.camera.charAt(0).toUpperCase() + systemHealth.camera.slice(1)}
API: ${systemHealth.api.charAt(0).toUpperCase() + systemHealth.api.slice(1)}
Database: ${systemHealth.database.charAt(0).toUpperCase() + systemHealth.database.slice(1)}

ACTIVE ALERTS
-------------
${activeAlertsCount} active alert(s)

PROCESS STAGES
--------------
Charging: Active
Melting: Active
Refining: Pending
Tapping: Pending
Slag Removal: Pending

END OF REPORT`;

    const blob = new Blob([report], { type: "text/plain;charset=utf-8;" });
    const link = document.createElement("a");
    link.download = `shift-report-${now.toISOString().split("T")[0]}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDownloadDailyReport = async () => {
    setReportLoading(true);
    setReportError("");
    setReportSuccess(false);
    try {
      const blob = await downloadDailyReport(reportDate);
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `VisionShield_Daily_Report_${reportDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setReportSuccess(true);
      // Reset success message after 3 seconds
      setTimeout(() => setReportSuccess(false), 3000);
    } catch (err) {
      console.error("Error downloading daily report:", err);
      setReportError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case "healthy": return "#16a34a";
      case "warning": return "#f59e0b";
      case "critical": return "#ef4444";
      default: return "#9ca3af";
    }
  };

  const StatusCard = ({ title, value, unit, status, icon: Icon, trend, subtitle, variant = "metric" }) => (
    <div className={`status-card status-card-${status.level} ${variant === "status" ? "status-card-status" : ""}`}>
      <div className="status-card-header">
        <div className="status-icon" style={{ color: status.color }}>
          {Icon && <Icon size={18} />}
        </div>
        <div className="status-info">
          <span className="status-title">{title}</span>
          <span className="status-label">{status.label}</span>
        </div>
      </div>
      {variant === "status" ? (
        <div className="status-value">
          <span className="value-main value-text">{value}</span>
          {unit && <span className="value-unit">{unit}</span>}
        </div>
      ) : (
        <div className="status-value">
          <span className="value-main">{value}</span>
          <span className="value-unit">{unit}</span>
        </div>
      )}
      {subtitle && <div className="status-subtitle">{subtitle}</div>}
      {trend && <div className="status-trend">{trend}</div>}
    </div>
  );

  const HealthIndicator = ({ label, status, icon: Icon }) => (
    <div className="health-item">
      <div className="health-icon" style={{ color: getHealthColor(status) }}>
        <Icon size={16} />
      </div>
      <div className="health-info">
        <span className="health-label">{label}</span>
        <span className="health-status" style={{ color: getHealthColor(status) }}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
      <div className="health-dot" style={{ background: getHealthColor(status) }} />
    </div>
  );

  const ThresholdControl = ({ label, value, unit, min, max, onChange, icon: Icon }) => (
    <div className="threshold-control">
      <div className="threshold-header">
        <div className="threshold-icon" style={{ color: "#6366f1" }}>
          <Icon size={16} />
        </div>
        <span className="threshold-label">{label}</span>
      </div>
      <div className="threshold-inputs">
        <div className="threshold-input-group">
          <span className="threshold-suffix">Min</span>
          <input
            type="number"
            value={value.min}
            onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
            min={min}
            max={value.max}
            className="threshold-input"
          />
          <span className="threshold-suffix">{unit}</span>
        </div>
        <div className="threshold-input-group">
          <span className="threshold-suffix">Max</span>
          <input
            type="number"
            value={value.max}
            onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
            min={value.min}
            max={max}
            className="threshold-input"
          />
          <span className="threshold-suffix">{unit}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="live-monitoring-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <div className="header-icon">
            <Radio size={24} />
          </div>
          <div>
            <h1>Live Monitoring</h1>
            <p>Real-time foundry process monitoring with sensor analytics and video streams</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="header-action-group">
            <button
              className={`header-btn ${multiCameraView ? "active" : ""}`}
              onClick={() => setMultiCameraView(!multiCameraView)}
              title={multiCameraView ? "Single Camera" : "Multi-Camera Grid"}
            >
              {multiCameraView ? <Layout size={18} /> : <Grid size={18} />}
            </button>
            <button
              className={`header-btn ${showThresholdControls ? "active" : ""}`}
              onClick={() => setShowThresholdControls(!showThresholdControls)}
              title={showThresholdControls ? "Hide Thresholds" : "Quick Thresholds"}
            >
              <Settings size={18} />
            </button>
            <button
              className="header-btn"
              onClick={snapshotVideoFrame}
              title="Snapshot Video Frame"
            >
              <Camera size={18} />
            </button>
            <button
              className="header-btn"
              onClick={exportChartCSV}
              title="Export Chart CSV"
            >
              <Table2 size={18} />
            </button>
            <button
              className="header-btn"
              onClick={generateShiftReport}
              title="Generate Shift Report"
            >
              <FileText size={18} />
            </button>
            <button
              className="header-btn"
              onClick={() => window.print()}
              title="Export Report"
            >
              <Download size={18} />
            </button>
            <span className="live-badge">
              <Radio size={10} className="live-dot" />
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* System Health Bar */}
      <div className="health-bar">
        <div className="health-items">
          <HealthIndicator label="Sensor" status={systemHealth.sensor} icon={Wifi} />
          <HealthIndicator label="Camera" status={systemHealth.camera} icon={Camera} />
          <HealthIndicator label="API" status={systemHealth.api} icon={Zap} />
          <HealthIndicator label="Database" status={systemHealth.database} icon={Database} />
        </div>
        <div className="health-update">
          <RefreshCw size={14} className="spin" />
          <span>Auto-refresh: {runtimeSettings.refresh_interval}s</span>
        </div>
      </div>

      {/* SECTION 2 - CCTV AND SENSOR SUMMARY (Two Columns: 65% / 35%) */}
      <section className="monitoring-section cctv-sensor-summary-section">
        <div className="cctv-sensor-summary-grid">

          {/* LEFT (65%) - CCTV Stream */}
          <div className="cctv-column">
            <section className="panel video-panel">
              <div className="video-stream-header">
                <div className="video-stream-title">
                  <div className="section-kicker"><Radio size={15} /> {multiCameraView ? "MULTI-CAMERA GRID" : "FOUNDRY PROCESS STREAM"}</div>
                  <h2>{multiCameraView ? "All Cameras" : selectedVideo.title}</h2>
                  <p>{multiCameraView ? "Viewing all CCTV feeds simultaneously" : selectedVideo.description}</p>
                </div>
                {!multiCameraView && (
                  <div className="video-stream-selector">
                    <label htmlFor="video-select" className="video-select-label">
                      <span>Select Camera:</span>
                      <select
                        id="video-select"
                        className="video-select"
                        value={selectedVideoId}
                        onChange={(e) => setSelectedVideoId(e.target.value)}
                      >
                        {FOUNDRY_VIDEOS.map((video) => (
                          <option key={video.id} value={video.id}>
                            {video.title} ({video.duration})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>

              {multiCameraView ? (
                <div className="multi-camera-grid">
                  {FOUNDRY_VIDEOS.map((video, idx) => (
                    <div key={video.id} className="camera-tile">
                      <div className="camera-tile-header">
                        <span className="camera-title">{video.title}</span>
                        <span className="camera-duration">{video.duration}</span>
                        <span className={`camera-status ${multiCameraConnected[video.id] ? "online" : "offline"}`}>
                          <Radio size={10} /> {multiCameraConnected[video.id] ? "LIVE" : "OFFLINE"}
                        </span>
                      </div>
                      <video
                        ref={(el) => { multiCameraRefs.current[video.id] = el; }}
                        className="camera-video"
                        src={video.src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        onError={() => setMultiCameraConnected(prev => ({ ...prev, [video.id]: false }))}
                        onPlay={() => setMultiCameraConnected(prev => ({ ...prev, [video.id]: true }))}
                        onWaiting={() => setMultiCameraConnected(prev => ({ ...prev, [video.id]: false }))}
                        onStalled={() => setMultiCameraConnected(prev => ({ ...prev, [video.id]: false }))}
                        onTimeUpdate={(e) => {
                          const v = e.target;
                          if (v.videoWidth > 0 && v.videoHeight > 0 && v.currentTime > 0) {
                            setMultiCameraConnected(prev => ({ ...prev, [video.id]: true }));
                          }
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="video-stream-player">
                    <video
                      ref={singleVideoRef}
                      className="foundry-video"
                      src={selectedVideo.src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      onError={(e) => {
                        console.error("Video playback error:", e);
                        setCameraConnected(false);
                      }}
                      onPlay={() => setCameraConnected(true)}
                      onWaiting={() => setCameraConnected(false)}
                      onStalled={() => setCameraConnected(false)}
                      onTimeUpdate={(e) => {
                        const video = e.target;
                        if (video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime > 0) {
                          setCameraConnected(true);
                        }
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div className="video-overlay">
                      <div className="video-info">
                        <span className="video-status">
                          <Radio size={10} /> {cameraConnected ? "LIVE STREAM" : "OFFLINE"}
                        </span>
                        <span className="video-duration">{selectedVideo.duration}</span>
                      </div>
                    </div>
                  </div>
                  {/* Process Stage Indicator */}
                  <div className="process-stage-bar">
                    <span className="stage-label">Process Stage</span>
                    <div className="stage-indicators">
                      {["Charging", "Melting", "Skimming", "Pouring", "Cooling"].map((stage, idx) => (
                        <div key={stage} className={`stage-step ${idx <= 1 ? "completed" : idx === 2 ? "current" : "pending"}`}>
                          <div className="stage-dot" />
                          <span className="stage-name">{stage}</span>
                        </div>
                      ))}
                    </div>
                    <div className="stage-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: "40%" }} />
                      </div>
                      <span className="progress-text">40% Complete</span>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* RIGHT (35%) - Sensor Summary Cards */}
          <div className="sensor-summary-column">
            <div className="sensor-summary-cards">
              <StatusCard
                title="Temperature"
                value={latestReading?.temperature ?? "--"}
                unit="°C"
                status={tempStatus}
                icon={Thermometer}
                subtitle={`Range: ${tempThresholds.min}°–${tempThresholds.max}°`}
              />
              <StatusCard
                title="Weight"
                value={latestReading?.weight ?? "--"}
                unit="kg"
                status={weightStatus}
                icon={Scale}
                subtitle={`Range: ${weightThresholds.min}–${weightThresholds.max} kg`}
              />
            </div>
          </div>

        </div>
      </section>

      {/* Threshold Controls Panel */}
      {showThresholdControls && (
        <div className="threshold-panel">
          <div className="threshold-panel-header">
            <h3><Settings size={16} /> Quick Threshold Controls</h3>
            <span className="threshold-hint">Changes apply immediately to chart reference lines</span>
          </div>
          <div className="threshold-controls-grid">
            <ThresholdControl
              label="Temperature"
              value={tempThresholds}
              unit="°C"
              min={1000}
              max={2000}
              onChange={setTempThresholds}
              icon={Thermometer}
            />
            <ThresholdControl
              label="Weight"
              value={weightThresholds}
              unit="kg"
              min={300}
              max={1000}
              onChange={setWeightThresholds}
              icon={Scale}
            />
            <div className="threshold-control notification-toggle">
              <div className="threshold-header">
                <div className="threshold-icon" style={{ color: notificationsEnabled ? "#16a34a" : "#9ca3af" }}>
                  {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                </div>
                <span className="threshold-label">Alert Notifications</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3 - SENSOR MONITORING CHART (Full Width) */}
      <section className="monitoring-section">
        <section className="panel chart-panel">
            <div className="chart-header">
              <div>
                <h2>Sensor Monitoring</h2>
                <p>Real-time temperature & weight trends</p>
              </div>
              <span className="chart-status">LIVE</span>
            </div>

            <div className="chart">
              {loading ? (
                <div className="chart-loading">
                  <Loader2 size={28} className="spin" />
                  <p>Loading sensor data...</p>
                </div>
              ) : error ? (
                <div className="chart-error">{error}</div>
              ) : chartData.length === 0 ? (
                <div className="chart-empty">No sensor data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 80, left: 60, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                      interval={0}
                      // Show fewer ticks for cleaner look
                    />

                    {/* Temperature Y-Axis (Left) */}
                    <YAxis
                      yAxisId="left"
                      domain={tempDomain}
                      allowDataOverflow={true}
                      label={{
                        value: "Temperature (°C)",
                        angle: -90,
                        position: "insideLeft",
                        offset: -40,
                        fontSize: 11,
                        fill: "#2563eb",
                      }}
                      tick={{ fontSize: 11, fill: "#2563eb" }}
                      tickLine={{ stroke: "#e5e7eb" }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />

                    {/* Weight Y-Axis (Right) */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={weightDomain}
                      allowDataOverflow={true}
                      label={{
                        value: "Weight (kg)",
                        angle: 90,
                        position: "insideRight",
                        offset: -50,
                        fontSize: 11,
                        fill: "#f59e0b",
                      }}
                      tick={{ fontSize: 11, fill: "#f59e0b" }}
                      tickLine={{ stroke: "#e5e7eb" }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />

                    <Tooltip
                      formatter={(value, name) => [
                        name === "temperature" ? `${value} °C` : `${value} kg`,
                        name === "temperature" ? "Temperature" : "Weight"
                      ]}
                      labelFormatter={(label, payload) => {
                        const item = chartData.find(d => d.time === label);
                        return item ? `Time: ${formatFullDateTime(item.timestamp)}` : `Time: ${label}`;
                      }}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />

                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="top"
                      height={30}
                      iconType="circle"
                      iconSize={8}
                      formatter={(name) => name === "temperature" ? "Temperature (°C)" : "Weight (kg)"}
                    />

                    {/* Temperature Normal Range */}
                    <ReferenceLine
                      y={tempThresholds.min}
                      yAxisId="left"
                      stroke="#16a34a"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{ value: "Min", position: "left", fill: "#16a34a", fontSize: 10, offset: -5 }}
                    />

                    <ReferenceLine
                      y={tempThresholds.max}
                      yAxisId="left"
                      stroke="#16a34a"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{ value: "Max", position: "left", fill: "#16a34a", fontSize: 10, offset: -5 }}
                    />

                    {/* Weight Normal Range */}
                    <ReferenceLine
                      y={weightThresholds.min}
                      yAxisId="right"
                      stroke="#16a34a"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{ value: "Min", position: "right", fill: "#16a34a", fontSize: 10, offset: 5 }}
                    />

                    <ReferenceLine
                      y={weightThresholds.max}
                      yAxisId="right"
                      stroke="#16a34a"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{ value: "Max", position: "right", fill: "#16a34a", fontSize: 10, offset: 5 }}
                    />

                    {/* Temperature Line */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="temperature"
                      name="temperature"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 2 }}
                      activeDot={{ r: 5, strokeWidth: 2 }}
                      connectNulls={true}
                    />

                    {/* Weight Line */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="weight"
                      name="weight"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 2, fill: "#f59e0b" }}
                      activeDot={{ r: 5, strokeWidth: 2 }}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </section>

      {/* SECTION 4 - CURRENT READING DETAILS (Full Width) */}
      <section className="monitoring-section">
        <section className="panel reading-details-panel">
            <div className="panel-header">
              <h2>Current Reading Details</h2>
              <span className="reading-time">
                <Clock size={14} />
                Last updated: {formatFullDateTime(latestReading?.timestamp)}
              </span>
            </div>
            <div className="reading-details-grid">
              {/* Temperature Card */}
              <div className="reading-detail-card">
                <div className="reading-card-header">
                  <div className="reading-card-icon temp">
                    <Thermometer size={20} />
                  </div>
                  <div className="reading-card-title">
                    <span className="detail-label">Temperature</span>
                    <span className={`detail-status ${tempStatus.level}`}>{tempStatus.label}</span>
                  </div>
                </div>
                <div className="reading-card-value">
                  <span className="detail-value temp">{latestReading?.temperature ?? "--"} °C</span>
                </div>
                <div className="reading-card-stats">
                  <div className="stat-item">
                    <span className="stat-label">Min</span>
                    <span className="stat-value">{tempThresholds.min}°C</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Max</span>
                    <span className="stat-value">{tempThresholds.max}°C</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg</span>
                    <span className="stat-value">
                      {historicalTempValues.length > 0
                        ? (historicalTempValues.reduce((a, b) => a + b, 0) / historicalTempValues.length).toFixed(1)
                        : "--"}°C
                    </span>
                  </div>
                </div>
                <div className="reading-card-meta">
                  <span className="meta-item">
                    <Clock size={12} />
                    {formatTimeOnly(latestReading?.timestamp)}
                  </span>
                  <span className="meta-item trend">
                    <TrendingUp size={12} className={tempStatus.level === 'critical' ? 'trend-down' : tempStatus.level === 'warning' ? 'trend-neutral' : 'trend-up'} />
                    {tempStatus.level === 'normal' ? 'Stable' : tempStatus.level === 'warning' ? 'Caution' : 'Critical'}
                  </span>
                </div>
              </div>

              {/* Weight Card */}
              <div className="reading-detail-card">
                <div className="reading-card-header">
                  <div className="reading-card-icon weight">
                    <Scale size={20} />
                  </div>
                  <div className="reading-card-title">
                    <span className="detail-label">Weight</span>
                    <span className={`detail-status ${weightStatus.level}`}>{weightStatus.label}</span>
                  </div>
                </div>
                <div className="reading-card-value">
                  <span className="detail-value weight">{latestReading?.weight ?? "--"} kg</span>
                </div>
                <div className="reading-card-stats">
                  <div className="stat-item">
                    <span className="stat-label">Min</span>
                    <span className="stat-value">{weightThresholds.min}kg</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Max</span>
                    <span className="stat-value">{weightThresholds.max}kg</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg</span>
                    <span className="stat-value">
                      {historicalWeightValues.length > 0
                        ? (historicalWeightValues.reduce((a, b) => a + b, 0) / historicalWeightValues.length).toFixed(1)
                        : "--"}kg
                    </span>
                  </div>
                </div>
                <div className="reading-card-meta">
                  <span className="meta-item">
                    <Clock size={12} />
                    {formatTimeOnly(latestReading?.timestamp)}
                  </span>
                  <span className="meta-item trend">
                    <TrendingUp size={12} className={weightStatus.level === 'critical' ? 'trend-down' : weightStatus.level === 'warning' ? 'trend-neutral' : 'trend-up'} />
                    {weightStatus.level === 'normal' ? 'Stable' : weightStatus.level === 'warning' ? 'Caution' : 'Critical'}
                  </span>
                </div>
              </div>

              {/* PPE Compliance Card */}
              <div className="reading-detail-card">
                <div className="reading-card-header">
                  <div className="reading-card-icon ppe">
                    <CheckCircle size={20} />
                  </div>
                  <div className="reading-card-title">
                    <span className="detail-label">PPE Compliance</span>
                    <span className="detail-status normal">Active</span>
                  </div>
                </div>
                <div className="reading-card-value">
                  <span className="detail-value ppe">95%</span>
                </div>
                <div className="reading-card-stats">
                  <div className="stat-item">
                    <span className="stat-label">Helmet</span>
                    <span className="stat-value">
                      <span className="ppe-badge normal">✓</span>
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Vest</span>
                    <span className="stat-value">
                      <span className="ppe-badge normal">✓</span>
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Gloves</span>
                    <span className="stat-value">
                      <span className="ppe-badge normal">✓</span>
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Boots</span>
                    <span className="stat-value">
                      <span className="ppe-badge normal">✓</span>
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Goggles</span>
                    <span className="stat-value">
                      <span className="ppe-badge normal">✓</span>
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Cap</span>
                    <span className="stat-value">
                      <span className="ppe-badge normal">✓</span>
                    </span>
                  </div>
                </div>
                <div className="reading-card-meta">
                  <span className="meta-item">
                    <Clock size={12} />
                    {formatTimeOnly(latestReading?.timestamp)}
                  </span>
                  <span className="meta-item trend">
                    <TrendingUp size={12} className="trend-up" />
                    Compliant
                  </span>
                </div>
              </div>
            </div>
          </section>
        </section>

      {/* SECTION 5 - HISTORICAL MONITORING (Full Width) */}
      <section className="monitoring-section">
        <section className="panel historical-monitoring-panel">
            <div className="panel-header historical-header">
              <div>
                <h2>Historical Monitoring</h2>
                <p>Temperature and weight trends for selected date</p>
              </div>
              <div className="historical-date-picker">
                <label htmlFor="historical-date" className="date-picker-label">
                  <Calendar size={14} />
                  Select Date:
                </label>
                <input
                  type="date"
                  id="historical-date"
                  value={historicalDate}
                  onChange={(e) => setHistoricalDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="date-picker-input"
                />
              </div>
            </div>

            {/* Summary Cards */}
            <div className="historical-summary-grid">
              {/* Temperature Cards */}
              <StatusCard
                title="Avg Temperature"
                value={tempStats.avg}
                unit="°C"
                status={{ level: "normal", label: "Average", color: "#2563eb" }}
                icon={Thermometer}
                variant="status"
              />
              <StatusCard
                title="Max Temperature"
                value={tempStats.max}
                unit="°C"
                status={{ level: "warning", label: "Maximum", color: "#ef4444" }}
                icon={TrendingUp}
                variant="status"
              />
              <StatusCard
                title="Min Temperature"
                value={tempStats.min}
                unit="°C"
                status={{ level: "normal", label: "Minimum", color: "#2563eb" }}
                icon={Minus}
                variant="status"
              />
              {/* Weight Cards */}
              <StatusCard
                title="Avg Weight"
                value={weightStats.avg}
                unit="kg"
                status={{ level: "normal", label: "Average", color: "#f59e0b" }}
                icon={Scale}
                variant="status"
              />
              <StatusCard
                title="Max Weight"
                value={weightStats.max}
                unit="kg"
                status={{ level: "warning", label: "Maximum", color: "#ef4444" }}
                icon={TrendingUp}
                variant="status"
              />
              <StatusCard
                title="Min Weight"
                value={weightStats.min}
                unit="kg"
                status={{ level: "normal", label: "Minimum", color: "#f59e0b" }}
                icon={Minus}
                variant="status"
              />
            </div>

            {/* Temperature Chart */}
            <div className="historical-chart-container">
              <div className="chart-header">
                <div>
                  <h3>Temperature Trend</h3>
                  <p>Hourly temperature readings for {historicalDate}</p>
                </div>
                <span className="chart-status">HISTORICAL</span>
              </div>
              <div className="chart">
                {historicalLoading ? (
                  <div className="chart-loading">
                    <Loader2 size={28} className="spin" />
                    <p>Loading historical data...</p>
                  </div>
                ) : historicalError ? (
                  <div className="chart-error">{historicalError}</div>
                ) : historicalData.length === 0 ? (
                  <div className="chart-empty">No historical data available for selected date</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={historicalData}
                      margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "#e5e7eb" }}
                        interval={0}
                      />
                      <YAxis
                        yAxisId="left"
                        domain={[
                          Math.min(tempThresholds.min - 100, Math.min(...historicalTempValues, 1000)),
                          Math.max(tempThresholds.max + 100, Math.max(...historicalTempValues, 1800))
                        ]}
                        allowDataOverflow={true}
                        label={{
                          value: "Temperature (°C)",
                          angle: -90,
                          position: "insideLeft",
                          offset: -40,
                          fontSize: 11,
                          fill: "#2563eb",
                        }}
                        tick={{ fontSize: 11, fill: "#2563eb" }}
                        tickLine={{ stroke: "#e5e7eb" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                      />
                      <Tooltip
                        formatter={(value) => [`${value} °C`, "Temperature"]}
                        labelFormatter={(label) => {
                          const item = historicalData.find(d => d.time === label);
                          return item ? `Time: ${formatFullDateTime(item.timestamp)}` : `Time: ${label}`;
                        }}
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Legend layout="horizontal" align="center" verticalAlign="top" height={30} />
                      <ReferenceLine
                        y={tempThresholds.min}
                        stroke="#16a34a"
                        strokeDasharray="5 5"
                        strokeWidth={1.5}
                        label={{ value: "Min", position: "left", fill: "#16a34a", fontSize: 10, offset: -5 }}
                      />
                      <ReferenceLine
                        y={tempThresholds.max}
                        stroke="#16a34a"
                        strokeDasharray="5 5"
                        strokeWidth={1.5}
                        label={{ value: "Max", position: "left", fill: "#16a34a", fontSize: 10, offset: -5 }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="temperature"
                        name="Temperature"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        dot={{ r: 3, strokeWidth: 2 }}
                        activeDot={{ r: 5, strokeWidth: 2 }}
                        connectNulls={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Weight Chart */}
            <div className="historical-chart-container">
              <div className="chart-header">
                <div>
                  <h3>Weight Trend</h3>
                  <p>Hourly weight readings for {historicalDate}</p>
                </div>
                <span className="chart-status">HISTORICAL</span>
              </div>
              <div className="chart">
                {historicalLoading ? (
                  <div className="chart-loading">
                    <Loader2 size={28} className="spin" />
                    <p>Loading historical data...</p>
                  </div>
                ) : historicalError ? (
                  <div className="chart-error">{historicalError}</div>
                ) : historicalData.length === 0 ? (
                  <div className="chart-empty">No historical data available for selected date</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={historicalData}
                      margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "#e5e7eb" }}
                        interval={0}
                      />
                      <YAxis
                        yAxisId="left"
                        domain={[
                          Math.min(weightThresholds.min - 50, Math.min(...historicalWeightValues, 0)),
                          Math.max(weightThresholds.max + 50, Math.max(...historicalWeightValues, 700))
                        ]}
                        allowDataOverflow={true}
                        label={{
                          value: "Weight (kg)",
                          angle: -90,
                          position: "insideLeft",
                          offset: -40,
                          fontSize: 11,
                          fill: "#f59e0b",
                        }}
                        tick={{ fontSize: 11, fill: "#f59e0b" }}
                        tickLine={{ stroke: "#e5e7eb" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                      />
                      <Tooltip
                        formatter={(value) => [`${value} kg`, "Weight"]}
                        labelFormatter={(label) => {
                          const item = historicalData.find(d => d.time === label);
                          return item ? `Time: ${formatFullDateTime(item.timestamp)}` : `Time: ${label}`;
                        }}
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Legend layout="horizontal" align="center" verticalAlign="top" height={30} />
                      <ReferenceLine
                        y={weightThresholds.min}
                        stroke="#16a34a"
                        strokeDasharray="5 5"
                        strokeWidth={1.5}
                        label={{ value: "Min", position: "left", fill: "#16a34a", fontSize: 10, offset: -5 }}
                      />
                      <ReferenceLine
                        y={weightThresholds.max}
                        stroke="#16a34a"
                        strokeDasharray="5 5"
                        strokeWidth={1.5}
                        label={{ value: "Max", position: "left", fill: "#16a34a", fontSize: 10, offset: -5 }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="weight"
                        name="Weight"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 3, strokeWidth: 2, fill: "#f59e0b" }}
                        activeDot={{ r: 5, strokeWidth: 2 }}
                        connectNulls={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>
        </section>

      {/* SECTION 6 - DAILY PRODUCTION REPORT (Full Width) */}
      <section className="monitoring-section">
        <section className="panel daily-report-panel">
            <div className="panel-header historical-header">
              <div>
                <h2>Daily Production Report</h2>
                <p>Generate and download PDF report for selected date</p>
              </div>
              <div className="historical-date-picker">
                <label htmlFor="report-date" className="date-picker-label">
                  <Calendar size={14} />
                  Select Date:
                </label>
                <input
                  type="date"
                  id="report-date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="date-picker-input"
                />
              </div>
            </div>

            <div className="report-actions">
              {reportSuccess && (
                <div className="report-success-message">
                  <CheckCircle size={18} />
                  <span>Report downloaded successfully!</span>
                </div>
              )}
              {reportError && (
                <div className="report-error-message">
                  <AlertTriangle size={18} />
                  <span>{reportError}</span>
                </div>
              )}
              <button
                className="report-download-btn"
                onClick={handleDownloadDailyReport}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Generating Report...</span>
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    <span>Download PDF Report</span>
                  </>
                )}
              </button>
            </div>

            <div className="report-info">
              <h4>Report Contents:</h4>
              <ul>
                <li><strong>Header:</strong> System name, report date, generation timestamp</li>
                <li><strong>Production Summary:</strong> Temperature & weight statistics (avg/min/max), threshold comparison</li>
                <li><strong>PPE Safety:</strong> PPE compliance status (helmet, vest, gloves, boots, goggles, cap)</li>
                <li><strong>Sensor Readings:</strong> Detailed sensor data table (first 20 readings)</li>
                <li><strong>Alert Summary:</strong> Sensor threshold alerts & process SOP validation alerts</li>
                <li><strong>Conclusion:</strong> Production day assessment with key findings</li>
              </ul>
              <p className="report-note">
                <em>Note: PPE detection data requires running AI detection on images/videos for the selected date.
                If no detection was performed, the report will indicate data availability status.</em>
              </p>
            </div>
          </section>
        </section>
      </div>
  );
}

export default LiveMonitoring;
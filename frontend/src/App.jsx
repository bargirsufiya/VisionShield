import { useEffect, useState, useRef } from "react";

import Login from "./pages/Login";

import visionShieldLogo from "./assets/visionshield-logo.png";

import {
  Activity,
  AlertTriangle,
  Bell,
  Database,
  Gauge,
  LayoutDashboard,
  Settings,
  Brain,
  Thermometer,
  Weight,
  Users,
  CheckCircle,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Radio,
  BarChart3,
  LogOut,
  Sun,
  Moon,
  Wrench,
} from "lucide-react";

import SensorChart from "./components/SensorChart";

import {
  getSensorData,
  getAlerts,
} from "./data/sensorData";

import useRuntimeSettings from "./hooks/useRuntimeSettings";

import { FOUNDRY_VIDEOS, getDefaultVideo } from "./config/videos";

import SensorData from "./pages/SensorData";
import Alerts from "./pages/Alerts";
import SettingsPage from "./pages/Settings";
import AIUpload from "./pages/AIUpload";
import ProcessDetection from "./pages/ProcessDetection";
import UserManagement from "./pages/UserManagement";
import LiveMonitoring from "./pages/LiveMonitoring";
import MaintenanceManagement from "./pages/MaintenanceManagement";

import { ThemeProvider, useTheme } from "./context/ThemeContext";

import "./App.css";

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const savedPage = localStorage.getItem("visionshield_currentPage");
      return savedPage ? savedPage : "dashboard";
    } catch (error) {
      return "dashboard";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("visionshield_currentPage", currentPage);
    } catch (error) {
      console.error("Failed to save currentPage to localStorage:", error);
    }
  }, [currentPage]);

  // Cleanup resize animation frame on unmount
  useEffect(() => {
    return () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
    };
  }, []);

  // =========================================
  // Login state
  // =========================================

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(
        "visionshield_user"
      );

      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      return null;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return (
      localStorage.getItem("visionshield_user") !== null
    );
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const resizeFrameRef = useRef(null);
  const pendingWidthRef = useRef(null);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);

    localStorage.setItem(
      "visionshield_user",
      JSON.stringify(userData)
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("visionshield_user");

    setUser(null);
    setIsLoggedIn(false);

    setCurrentPage("dashboard");
  };

  // =========================================
  // Role-Based Page Protection
  // =========================================

  useEffect(() => {
    if (!user) {
      return;
    }

    // Operator cannot access Settings
    if (
      user.role === "Operator" &&
      currentPage === "settings"
    ) {
      setCurrentPage("dashboard");
    }

    // Operator cannot access Maintenance Management
    if (
      user.role === "Operator" &&
      currentPage === "maintenance-management"
    ) {
      setCurrentPage("dashboard");
    }

    // Only Administrator can access User Management
    if (
      currentPage === "user-management" &&
      user.role !== "Administrator"
    ) {
      setCurrentPage("dashboard");
    }
  }, [user, currentPage]);

  // =========================================
  // Close User Dropdown on Outside Click
  // =========================================

  useEffect(() => {
    function handleClickOutside(event) {
      if (showUserMenu && event.target.closest('.user') === null && event.target.closest('.user-dropdown') === null) {
        setShowUserMenu(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showUserMenu]);

  // =========================================
  // Sensor and Alert State
  // =========================================

  const [sensorReadings, setSensorReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const runtimeSettings = useRuntimeSettings();

  // =========================================
  // Video Player State
  // =========================================

  const [selectedVideoId, setSelectedVideoId] = useState(() => {
    try {
      const saved = localStorage.getItem("visionshield_selectedVideo");
      return saved || getDefaultVideo().id;
    } catch {
      return getDefaultVideo().id;
    }
  });

  const selectedVideo = FOUNDRY_VIDEOS.find(v => v.id === selectedVideoId) || getDefaultVideo();

  useEffect(() => {
    try {
      localStorage.setItem("visionshield_selectedVideo", selectedVideoId);
    } catch (error) {
      console.error("Failed to save video selection:", error);
    }
  }, [selectedVideoId]);

  // =========================================
  // Fetch Sensor Data and Alerts
  // =========================================

  useEffect(() => {
    async function fetchSensorData() {
      try {
        // Fetch ALL records (large limit) instead of paginated 10
        // Pass globalSearch to filter sensor readings
        const sensorData = await getSensorData(1, 10000, globalSearch);
        // Pass showRecentResolved=false to get ALL active alerts (not filtered by resolved_at)
        const alertData = await getAlerts(1, 10000, null, null, false);

        // Extract records from paginated responses
        setSensorReadings(sensorData?.records || []);
        setAlerts(alertData?.alerts || []);
      } catch (error) {
        console.error(
          "Error fetching sensor data:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    // Fetch immediately
    fetchSensorData();

    const intervalMs = Math.max(1, Number(runtimeSettings.refresh_interval) || 5) * 1000;
    const interval = setInterval(
      fetchSensorData,
      intervalMs
    );

    // Stop polling when component is removed
    return () => clearInterval(interval);
  }, [runtimeSettings.refresh_interval, globalSearch]);

  // =========================================
  // Buzzer / Sound Alert for New Alerts
  // =========================================

  const [buzzerEnabled, setBuzzerEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("visionshield_buzzer_enabled");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const prevActiveAlertIds = useRef(new Set());
  const audioContextRef = useRef(null);

  // Initialize AudioContext on first user interaction
  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
  };

  // Play buzzer sound using Web Audio API
  const playBuzzer = () => {
    if (!buzzerEnabled) return;

    ensureAudioContext();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;

    // Create oscillator for buzzer tone
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "square"; // Harsh buzzer sound
    oscillator.frequency.setValueAtTime(800, now); // 800 Hz
    oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.5); // Sweep down

    // Volume envelope
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.5);

    // Play a second beep after short delay for urgency
    setTimeout(() => {
      if (!buzzerEnabled) return;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "square";
      osc2.frequency.setValueAtTime(1000, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.4);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.4);
    }, 600);
  };

  // Check for new alerts and trigger buzzer
  useEffect(() => {
    const currentActiveIds = new Set(
      alerts.filter(a => a.status?.toLowerCase() === "active").map(a => a._id)
    );

    // Find new alerts that weren't in previous fetch
    const newAlertIds = [...currentActiveIds].filter(id => !prevActiveAlertIds.current.has(id));

    if (newAlertIds.length > 0 && prevActiveAlertIds.current.size > 0) {
      // Only play buzzer if we had previous alerts to compare against (not initial load)
      playBuzzer();
    }

    prevActiveAlertIds.current = currentActiveIds;
  }, [alerts, buzzerEnabled]);

  // =========================================
  // Normal operating ranges
  // =========================================

  const TEMP_MIN = runtimeSettings.min_temperature;
  const TEMP_MAX = runtimeSettings.max_temperature;

  const WEIGHT_MIN = runtimeSettings.min_weight;
  const WEIGHT_MAX = runtimeSettings.max_weight;

  // =========================================
  // Check whether a reading is abnormal
  // =========================================

  const isAbnormal = (reading) => {
    return (
      reading.temperature < TEMP_MIN ||
      reading.temperature > TEMP_MAX ||
      reading.weight < WEIGHT_MIN ||
      reading.weight > WEIGHT_MAX
    );
  };

  // =========================================
  // Find abnormal readings
  // =========================================

  const abnormalReadings =
    sensorReadings.filter(isAbnormal);

  // =========================================
  // Use actual alerts from MongoDB
  // =========================================

  const activeAlerts = alerts.filter(
    (alert) => alert.status?.toLowerCase() === "active"
  );

  const recentReadings = sensorReadings.slice(0, 5);

  const recentAlerts = activeAlerts.slice(0, 3);

  // =========================================
  // Latest reading
  // =========================================

  const latestReading = sensorReadings[0] || null;

const latestTemperatureAbnormal =
  latestReading
    ? latestReading.temperature < TEMP_MIN ||
      latestReading.temperature > TEMP_MAX
    : false;

const latestWeightAbnormal =
  latestReading
    ? latestReading.weight < WEIGHT_MIN ||
      latestReading.weight > WEIGHT_MAX
    : false;
  // =========================================
  // System status
  // =========================================

  const systemStatus =
    activeAlerts.length > 0
      ? "Abnormal"
      : "Normal";

  // =========================================
  // Page title
  // =========================================

  const pageTitle =
    currentPage === "dashboard"
      ? "Dashboard"
      : currentPage === "sensor-data"
      ? "Sensor Data"
      : currentPage === "alerts"
      ? "Alerts"
      : currentPage === "ai-upload"
      ? "AI PPE Detection"
      : currentPage === "process-detection"
      ? "Process Detection"
      : currentPage === "user-management"
      ? "User Management"
      : currentPage === "maintenance-management"
      ? "Maintenance Management"
      : "Settings";

  // =========================================
  // LOGIN GATE
  // =========================================

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // =========================================
  // MAIN APPLICATION
  // =========================================

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleResize = (e) => {
  const newWidth = Math.max(48, Math.min(e.clientX, 500));
  pendingWidthRef.current = newWidth;

  if (resizeFrameRef.current === null) {
    resizeFrameRef.current = requestAnimationFrame(flushPendingWidth);
  }
};

  const flushPendingWidth = () => {
    resizeFrameRef.current = null;
    if (pendingWidthRef.current !== null) {
      setSidebarWidth(pendingWidthRef.current);
      pendingWidthRef.current = null;
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    // Flush any pending width on resize end
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
      flushPendingWidth();
    }
  };

  const toggleSidebar = () => {
    if (sidebarWidth > 100) {
      setSidebarWidth(48);
    } else {
      setSidebarWidth(250);
    }
  };

  return (
    <div className="app">

      {/* Sidebar */}

      <aside
        className={`sidebar ${sidebarWidth < 120 ? "sidebar-narrow" : ""}`}
        style={{ width: sidebarWidth }}
      >

        {/* Brand */}

        <div className="sidebar-brand">

          <div className="brand-logo">
            <img
              src={visionShieldLogo}
              alt="VisionShield Logo"
            />
          </div>

          <div className="brand-text">
            <h2>VisionShield</h2>
            <span>AI FOUNDRY INTELLIGENCE</span>
          </div>

          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarWidth > 100 ? "Collapse Sidebar" : "Expand Sidebar"}
            aria-label={sidebarWidth > 100 ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {sidebarWidth > 100 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>

        </div>

        {/* Navigation */}

        <div className="sidebar-section-title">
          MAIN MENU
        </div>

        <nav className="sidebar-nav">

          {/* Dashboard */}

          <button
            className={
              currentPage === "dashboard"
                ? "sidebar-nav-item active"
                : "sidebar-nav-item"
            }
            onClick={() =>
              setCurrentPage("dashboard")
            }
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>

          {/* Alerts */}

          <button
            className={
              currentPage === "alerts"
                ? "sidebar-nav-item active"
                : "sidebar-nav-item"
            }
            onClick={() =>
              setCurrentPage("alerts")
            }
          >
            <AlertTriangle size={19} />
            <span>Alerts</span>

            {activeAlerts.length > 0 && (
              <span className="sidebar-alert-badge">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* AI PPE Detection */}

          <button
            className={
              currentPage === "ai-upload"
                ? "sidebar-nav-item active"
                : "sidebar-nav-item"
            }
            onClick={() =>
              setCurrentPage("ai-upload")
            }
          >
            <Brain size={19} />
            <span>AI Safety Monitoring</span>
          </button>

          {/* Sensor Data */}

          <button
            className={
              currentPage === "sensor-data"
                ? "sidebar-nav-item active"
                : "sidebar-nav-item"
            }
            onClick={() =>
              setCurrentPage("sensor-data")
            }
          >
            <Database size={19} />
            <span>Sensor Analytics</span>
          </button>

          <button
            className={
              currentPage === "live-monitoring"
                ? "sidebar-nav-item active"
                : "sidebar-nav-item"
            }
            onClick={() => setCurrentPage("live-monitoring")}
          >
            <Radio size={19} />
            <span>Live Monitoring</span>
          </button>

                    <button
            className={
              currentPage === "process-detection"
                ? "sidebar-nav-item active"
                : "sidebar-nav-item"
            }
            onClick={() => setCurrentPage("process-detection")}
          >
            <BarChart3 size={19} />
            <span>Process Detection</span>
          </button>

        </nav>

        {/* System */}

        <div className="sidebar-section-title system-title">
          SYSTEM
        </div>

        <nav className="sidebar-nav">

          {/* Settings */}

          {(user?.role === "Administrator" ||
            user?.role === "Supervisor") && (
            <button
              className={
                currentPage === "settings"
                  ? "sidebar-nav-item active"
                  : "sidebar-nav-item"
              }
              onClick={() =>
                setCurrentPage("settings")
              }
            >
              <Settings size={19} />
              <span>Settings</span>
            </button>
          )}

          {/* Maintenance Management */}

          {(user?.role === "Administrator" ||
            user?.role === "Supervisor") && (
            <button
              className={
                currentPage === "maintenance-management"
                  ? "sidebar-nav-item active"
                  : "sidebar-nav-item"
              }
              onClick={() =>
                setCurrentPage("maintenance-management")
              }
            >
              <Wrench size={19} />
              <span>Maintenance Management</span>
            </button>
          )}

          {/* User Management */}

          {user?.role === "Administrator" && (
            <button
              className={
                currentPage === "user-management"
                  ? "sidebar-nav-item active"
                  : "sidebar-nav-item"
              }
              onClick={() =>
                setCurrentPage("user-management")
              }
            >
              <Users size={19} />
              <span>User Management</span>
            </button>
          )}

          </nav>

        {/* Bottom Status */}

        <div className="sidebar-bottom">

          <div className="system-status">

            <span className="status-dot"></span>

            <div className="system-status-text">
              <strong>System Online</strong>

              <small>
                All services connected
              </small>
            </div>

          </div>

        </div>

      </aside>

      {/* Resize Handle - Outside sidebar for better drag target */}
      <div
        className="sidebar-resize-handle"
        style={{ left: sidebarWidth }}
        onMouseDown={handleResizeStart}
        title="Drag to resize sidebar"
      />

      {/* Main Content */}

      <main className="main" style={{ marginLeft: sidebarWidth, width: `calc(100% - ${sidebarWidth}px)` }}>

        {/* Header */}

        <header className="header">

          <div className="header-title-group">

            <div>
              <h1>{pageTitle}</h1>
              {currentPage === "dashboard" && (
                <p>Real-time overview of foundry operations and system health</p>
              )}
            </div>

          </div>

          <div className="header-right">

            <div className="global-search">
              <Search size={17} />
              <input
                aria-label="Search"
                placeholder="Search sensors, alerts, reports..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </div>

            {/* Theme Toggle */}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Notification */}
<div className="notification">

  <button
    className="notification-button"
    onClick={() =>
      setShowNotifications(!showNotifications)
    }
    aria-label="Notifications"
  >
    <Bell size={21} />

    {activeAlerts.length > 0 && (
      <span className="notification-badge">
        {activeAlerts.length}
      </span>
    )}
  </button>

  {showNotifications && (
    <div className="notification-dropdown">

      <div className="notification-dropdown-header">
        <div>
          <h3>Notifications</h3>
          <span>
            {activeAlerts.length} active alert
            {activeAlerts.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="notification-list">

        {activeAlerts.length === 0 ? (

          <div className="notification-empty">
            <CheckCircle size={22} />
            <strong>No Active Alerts</strong>
            <span>
              All monitored conditions are normal.
            </span>
          </div>

        ) : (

          activeAlerts.slice(0, 5).map((alert) => {

            const temperatureProblem =
              alert.temperature < TEMP_MIN ||
              alert.temperature > TEMP_MAX;

            const weightProblem =
              alert.weight < WEIGHT_MIN ||
              alert.weight > WEIGHT_MAX;

            return (
              <div
                className="notification-item"
                key={alert._id}
                onClick={() => {
                  setShowNotifications(false);
                  setCurrentPage("alerts");
                }}
              >

                <div className="notification-item-icon">
                  <AlertTriangle size={17} />
                </div>

                <div className="notification-item-content">

                  <strong>
                    Abnormal Condition
                  </strong>

                  {temperatureProblem && (
                    <span>
                      Temperature:{" "}
                      {alert.temperature} °C
                    </span>
                  )}

                  {weightProblem && (
                    <span>
                      Weight:{" "}
                      {alert.weight} kg
                    </span>
                  )}

                  <small>
                    Detected:{" "}
                    {new Date(
                      alert.detected_at
                    ).toLocaleString()}
                  </small>

                </div>

              </div>
            );
          })

        )}

      </div>

      {activeAlerts.length > 0 && (
        <button
          className="notification-view-all"
          onClick={() => {
            setShowNotifications(false);
            setCurrentPage("alerts");
          }}
        >
          View All Alerts
        </button>
      )}

    </div>
  )}

</div>

            {/* User */}

            <div className="user" onClick={() => setShowUserMenu(!showUserMenu)}>

              <div className="avatar">
                {user?.username
                  ? user.username
                      .charAt(0)
                      .toUpperCase()
                  : "S"}
              </div>

              <div className="user-details">

                <strong>
                  {user?.username || "User"}
                </strong>

                <small>
                  {user?.role || "Operator"}
                </small>

              </div>

              <ChevronDown size={15} className={`user-chevron ${showUserMenu ? "rotated" : ""}`} />

            </div>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="user-dropdown" role="menu">
                <div className="user-dropdown-header">
                  <div className="dropdown-avatar">
                    {user?.username
                      ? user.username
                          .charAt(0)
                          .toUpperCase()
                      : "S"}
                  </div>
                  <div className="dropdown-user-info">
                    <strong>{user?.username || "User"}</strong>
                    <span className="dropdown-role">{user?.role || "Operator"}</span>
                  </div>
                </div>
                <div className="user-dropdown-divider"></div>

                <button className="dropdown-item" role="menuitem" onClick={() => { setCurrentPage("dashboard"); setShowUserMenu(false); }}>
                  <LayoutDashboard size={16} /> Dashboard
                </button>

                <button className="dropdown-item" role="menuitem" onClick={() => { setCurrentPage("live-monitoring"); setShowUserMenu(false); }}>
                  <Radio size={16} /> Live Monitoring
                </button>

                {user?.role === "Administrator" && (
                  <>
                    <button className="dropdown-item" role="menuitem" onClick={() => { setCurrentPage("user-management"); setShowUserMenu(false); }}>
                      <Users size={16} /> User Management
                    </button>
                    <button className="dropdown-item" role="menuitem" onClick={() => { setCurrentPage("settings"); setShowUserMenu(false); }}>
                      <Settings size={16} /> System Settings
                    </button>
                    <div className="user-dropdown-divider"></div>
                  </>
                )}

                <button className="dropdown-item" role="menuitem" onClick={() => { setCurrentPage("alerts"); setShowUserMenu(false); }}>
                  <AlertTriangle size={16} /> Alerts & Notifications
                </button>
                <button className="dropdown-item" role="menuitem" onClick={() => { setCurrentPage("sensor-data"); setShowUserMenu(false); }}>
                  <Database size={16} /> Sensor Data
                </button>
                <button className="dropdown-item" role="menuitem" onClick={() => { setCurrentPage("ai-upload"); setShowUserMenu(false); }}>
                  <Brain size={16} /> AI PPE Detection
                </button>
                <button className="dropdown-item" role="menuitem" onClick={() => { setCurrentPage("process-detection"); setShowUserMenu(false); }}>
                  <Gauge size={16} /> Process Detection
                </button>

                <div className="user-dropdown-divider"></div>

                <button className="dropdown-item" role="menuitem" onClick={handleLogout}>
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}

          </div>

        </header>

        {/* ==============================
            DASHBOARD
        ============================== */}

        {currentPage === "dashboard" ? (

          <>

            <div className="dashboard-context-bar">
              <div>
                <span className="eyebrow">OPERATIONS COMMAND CENTER</span>
                <strong>Foundry process monitoring</strong>
              </div>
              <div className="context-meta">
                <span className="live"><span></span> {runtimeSettings.monitoring_enabled ? "LIVE" : "PAUSED"}</span>
                <span>
                  {runtimeSettings.monitoring_enabled
                    ? `Monitoring · ${runtimeSettings.refresh_interval} sec`
                    : "Monitoring off"}
                </span>
                {/* Buzzer Toggle */}
                <button
                  className={`buzzer-toggle ${buzzerEnabled ? "enabled" : "disabled"}`}
                  onClick={() => {
                    setBuzzerEnabled(!buzzerEnabled);
                    localStorage.setItem("visionshield_buzzer_enabled", JSON.stringify(!buzzerEnabled));
                  }}
                  title={buzzerEnabled ? "Disable alert buzzer" : "Enable alert buzzer"}
                  aria-label={buzzerEnabled ? "Alert buzzer enabled" : "Alert buzzer disabled"}
                >
                  <span className="buzzer-icon">🔊</span>
                  <span className="buzzer-label">{buzzerEnabled ? "ON" : "OFF"}</span>
                </button>
              </div>
            </div>

            {/* System Overview */}

            <section className="overview">

              {/* System Status */}

              <div className="overview-card">

                <div className="overview-icon blue">
                  <Activity />
                </div>

                <div>

                  <span>
                    System Status
                  </span>

                  <h3>
                    {systemStatus}
                  </h3>

                  <small>
                    {activeAlerts.length > 0
                      ? `${activeAlerts.length} abnormal condition${
                          activeAlerts.length > 1
                            ? "s"
                            : ""
                        } detected`
                      : "No abnormal conditions detected"}
                  </small>

                </div>

              </div>

              {/* Monitoring Status */}

              <div className="overview-card">

                <div className="overview-icon green">
                  <Gauge />
                </div>

                <div>

                  <span>
                    Monitoring Status
                  </span>

                  <h3>
                    Active
                  </h3>

                  <small>
                    Sensor monitoring active
                  </small>

                </div>

              </div>

              {/* Sensor Readings */}

              <div className="overview-card">

                <div className="overview-icon orange">
                  <Database />
                </div>

                <div>

                  <span>
                    Sensor Readings
                  </span>

                  <h3>
                    {sensorReadings.length}
                  </h3>

                  <small>
                    Records in database
                  </small>

                </div>

              </div>

              {/* Active Alerts */}

              <div className="overview-card">

                <div className="overview-icon red">
                  <AlertTriangle />
                </div>

                <div>

                  <span>
                    Active Alerts
                  </span>

                  <h3>
                    {activeAlerts.length}
                  </h3>

                  <small>
                    {activeAlerts.length > 0
                      ? "Immediate attention required"
                      : "No alerts at present"}
                  </small>

                </div>

              </div>

            </section>

            {/* Current Sensor Data */}

            <section className="section">

              <div className="section-header">

                <div>

                  <h2>
                    Current Sensor Data
                  </h2>

                  <p>
                    Latest readings from monitoring system
                  </p>

                </div>

                <span className="live">
                  <span></span>
                  LIVE
                </span>

              </div>

              <div className="sensor-grid">

                {/* Temperature */}

                <div className="sensor-card">

                  <div className="sensor-top">

                    <div className="sensor-title">

                      <div className="sensor-icon temperature">
                        <Thermometer />
                      </div>

                      <div>

                        <span>
                          Temperature
                        </span>

                        <h3>
                         {latestReading
  ? `${latestReading.temperature} °C`
  : "No data"}
                        </h3>

                      </div>

                    </div>

                    <span
                      className={
                        latestTemperatureAbnormal
                          ? "status-alert"
                          : "normal-badge"
                      }
                    >
                      {latestTemperatureAbnormal
                        ? "ABNORMAL"
                        : "NORMAL"}
                    </span>

                  </div>

                  <div className="sensor-bar">
                    <div className="sensor-fill temperature-fill"></div>
                  </div>

                  <div className="sensor-range">

                    <span>
                      Normal Range
                    </span>

                    <strong>
                      {TEMP_MIN}°C – {TEMP_MAX}°C
                    </strong>

                  </div>

                </div>

                {/* Weight */}

                <div className="sensor-card">

                  <div className="sensor-top">

                    <div className="sensor-title">

                      <div className="sensor-icon weight">
                        <Weight />
                      </div>

                      <div>

                        <span>
                          Weight
                        </span>

                        <h3>
                         {latestReading
  ? `${latestReading.weight} kg`
  : "No data"}
                        </h3>

                      </div>

                    </div>

                    <span
                      className={
                        latestWeightAbnormal
                          ? "status-alert"
                          : "normal-badge"
                      }
                    >
                      {latestWeightAbnormal
                        ? "ABNORMAL"
                        : "NORMAL"}
                    </span>

                  </div>

                  <div className="sensor-bar">
                    <div className="sensor-fill weight-fill"></div>
                  </div>

                  <div className="sensor-range">

                    <span>
                      Expected Range
                    </span>

                    <strong>
                      {WEIGHT_MIN} – {WEIGHT_MAX} kg
                    </strong>

                  </div>

                </div>

              </div>

            </section>

            {/* Foundry Video Stream */}

            <section className="live-monitoring-strip">
              <div className="video-stream-header">
                <div className="video-stream-title">
                  <div className="section-kicker"><Radio size={15} /> FOUNDRY PROCESS STREAM</div>
                  <h2>{selectedVideo.title}</h2>
                  <p>{selectedVideo.description}</p>
                </div>
                <div className="video-stream-selector">
                  <label htmlFor="video-select" className="video-select-label">
                    <span>Select Process:</span>
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
              </div>
              <div className="video-stream-player">
                <video
                  className="foundry-video"
                  src={selectedVideo.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={(e) => {
                    console.error("Video playback error:", e);
                    if (e.target && e.target.error) {
                      console.error("Video error code:", e.target.error.code);
                      console.error("Video error message:", e.target.error.message);
                    }
                  }}
                >
                  Your browser does not support the video tag.
                </video>
                <div className="video-overlay">
                  <div className="video-info">
                    <span className="video-status"><Radio size={10} /> LIVE STREAM</span>
                    <span className="video-duration">{selectedVideo.duration}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Sensor Monitoring Chart */}

            <SensorChart />

            {/* Bottom Section */}

            <section className="bottom-grid">

              {/* Recent Sensor Readings */}

              <div className="panel">

                <div className="panel-header">

                  <div>

                    <h2>
                      Recent Sensor Readings
                    </h2>

                    <p>
                      Latest data received from sensors
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage("sensor-data")
                    }
                  >
                    View All
                  </button>

                </div>

                <div className="table">

                  <div className="table-header">

                    <span>
                      Reading
                    </span>

                    <span>
                      Temperature
                    </span>

                    <span>
                      Weight
                    </span>

                    <span>
                      Status
                    </span>

                  </div>

                  {recentReadings.map((reading) => {

                    const abnormal =
                      isAbnormal(reading);

                    return (
                      <div
                        className="table-row"
                        key={reading._id}
                      >

                        <span>
                          Sensor
                        </span>

                        <span>
                          {reading.temperature} °C
                        </span>

                        <span>
                          {reading.weight} kg
                        </span>

                        <span
                          className={
                            abnormal
                              ? "status-alert"
                              : "status-normal"
                          }
                        >
                          {abnormal
                            ? "Abnormal"
                            : "Normal"}
                        </span>

                      </div>
                    );
                  })}

                </div>

              </div>

              {/* Alerts Panel */}

              <div className="panel alert-panel">

                <div className="panel-header">

                  <div>

                    <h2>
                      Alerts
                    </h2>

                    <p>
                      {activeAlerts.length > 0
                        ? "Active abnormal conditions"
                        : "System operating normally"}
                    </p>

                  </div>

                  <div className="alert-header-right">

                    {activeAlerts.length > 0 && (
                      <span className="active-alert-count">
                        {activeAlerts.length} Active
                      </span>
                    )}

                    <button
                      onClick={() =>
                        setCurrentPage("alerts")
                      }
                      className="view-all-btn"
                    >
                      View All
                    </button>

                  </div>

                </div>

                {activeAlerts.length > 0 ? (

                  <div className="dashboard-alert-list">

                    {recentAlerts.map((reading) => {

                      const temperatureProblem =
                        reading.temperature < TEMP_MIN ||
                        reading.temperature > TEMP_MAX;

                      const weightProblem =
                        reading.weight < WEIGHT_MIN ||
                        reading.weight > WEIGHT_MAX;

                      let problem = "";
                      let value = "";

                      if (temperatureProblem) {

                        problem =
                          "Temperature outside safe range";

                        value =
                          `${reading.temperature} °C`;

                      } else if (weightProblem) {

                        problem =
                          "Weight outside expected range";

                        value =
                          `${reading.weight} kg`;
                      }

                      return (
                        <div
                          className="dashboard-alert-row"
                          key={reading._id}
                        >

                          <div className="alert-severity-indicator">
                            <AlertTriangle size={17} />
                          </div>

                          <div className="alert-row-content">

                            <div className="alert-row-top">

                              <strong>
                                Sensor Alert
                              </strong>

                              <span className="critical-badge">
                                CRITICAL
                              </span>

                            </div>

                            <div className="alert-row-bottom">

                              <span className="alert-problem">
                                {problem}
                              </span>

                              <span className="alert-value">
                                {value}
                              </span>

                            </div>

                          </div>

                        </div>
                      );
                    })}

                    {activeAlerts.length > 3 && (

                      <button
                        className="more-alerts-btn"
                        onClick={() =>
                          setCurrentPage("alerts")
                        }
                      >
                        View {activeAlerts.length - 3} more alert
                        {activeAlerts.length - 3 > 1
                          ? "s"
                          : ""}

                        <span>
                          →
                        </span>

                      </button>

                    )}

                  </div>

                ) : (

                  <div className="dashboard-no-alert">

                    <div className="dashboard-check-icon">
                      ✓
                    </div>

                    <div>

                      <strong>
                        All Systems Normal
                      </strong>

                      <p>
                        No abnormal conditions detected.
                      </p>

                    </div>

                  </div>

                )}

              </div>

            </section>

            {/* Footer */}

            <footer>

              VisionShield Monitoring System{" "}

              <span>•</span>{" "}

              Connected to MongoDB{" "}

              <span>•</span>{" "}

              Backend API Online

            </footer>

          </>

        ) : currentPage === "live-monitoring" ? (

          <LiveMonitoring />

        ) : currentPage === "sensor-data" ? (

          <SensorData />

        ) : currentPage === "alerts" ? (

          <Alerts />

        ) : currentPage === "ai-upload" ? (

          <AIUpload />        ) : currentPage === "ai-upload" ? (

          <AIUpload />

        ) : currentPage === "process-detection" ? (     // ← add

          <ProcessDetection />                           // ← add

        ) : currentPage === "maintenance-management" ? (

          <MaintenanceManagement />

        ) : currentPage === "user-management" ? (

          <UserManagement user={user} />

        

        ) : currentPage === "maintenance-management" ? (

          <MaintenanceManagement />

        ) : currentPage === "user-management" ? (

          <UserManagement user={user} />

        ) : (

          <SettingsPage />

        )}

      </main>

    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
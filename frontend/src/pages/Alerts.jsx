import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, CheckCircle, Clock, Filter, X, ChevronLeft, ChevronRight, Bell, RefreshCw } from "lucide-react";
import {
  getAlerts,
  resolveAlert
} from "../data/sensorData";
import useRuntimeSettings from "../hooks/useRuntimeSettings";

function formatDateTimeUTC(timestamp) {
  if (!timestamp) return "Not available";
  const timestampString = String(timestamp);
  const hasTimezone = timestampString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(timestampString);
  const utcTimestamp = hasTimezone ? timestampString : `${timestampString}Z`;
  return new Date(utcTimestamp).toLocaleString();
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function Alerts() {
  const [alertsData, setAlertsData] = useState({ active: [], resolved: [] });
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "resolved"
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total_alerts: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  });

  // Filter state
  const [filters, setFilters] = useState({
    status_filter: null,
    date_filter: null,
    show_recent_resolved: false
  });

  const runtimeSettings = useRuntimeSettings();
  const TEMP_MIN = runtimeSettings.min_temperature;
  const TEMP_MAX = runtimeSettings.max_temperature;
  const WEIGHT_MIN = runtimeSettings.min_weight;
  const WEIGHT_MAX = runtimeSettings.max_weight;

  // Fetch alerts data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const data = await getAlerts(
          pagination.page,
          pagination.limit,
          filters.status_filter,
          filters.date_filter,
          filters.show_recent_resolved
        );

        const activeAlerts = data.alerts.filter(alert => alert.status?.toLowerCase() === "active");
        const resolvedAlerts = data.alerts.filter(alert => alert.status?.toLowerCase() === "resolved");

        setAlertsData({ active: activeAlerts, resolved: resolvedAlerts });
        setPagination(prev => ({ ...prev, ...data.pagination }));
      } catch (error) {
        console.error("Error fetching alerts:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [pagination.page, pagination.limit, filters.status_filter, filters.date_filter, filters.show_recent_resolved, refreshTrigger]);

  const handleResolveAlert = async (alertId) => {
    try {
      setResolvingId(alertId);
      const savedUser = localStorage.getItem("visionshield_user");
      if (!savedUser) throw new Error("User session not found.");
      const user = JSON.parse(savedUser);
      if (user.role !== "Administrator") throw new Error("Only Administrator can resolve alerts.");

      const result = await resolveAlert(alertId, user.session_token);
      setRefreshTrigger(prev => prev + 1); // Trigger refetch
    } catch (error) {
      console.error("Error resolving alert:", error);
      alert(error.message || "Failed to resolve alert.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      status_filter: null,
      date_filter: null,
      show_recent_resolved: true
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = filters.status_filter || filters.date_filter || !filters.show_recent_resolved;

  // Memoized stats
  const stats = useMemo(() => ({
    totalActive: alertsData.active.length,
    totalResolved: alertsData.resolved.length,
    totalAll: pagination.total_alerts,
    tempAlerts: alertsData.active.filter(a => {
      const tMin = a.thresholds?.min_temperature ?? TEMP_MIN;
      const tMax = a.thresholds?.max_temperature ?? TEMP_MAX;
      return a.temperature < tMin || a.temperature > tMax;
    }).length,
    weightAlerts: alertsData.active.filter(a => {
      const wMin = a.thresholds?.min_weight ?? WEIGHT_MIN;
      const wMax = a.thresholds?.max_weight ?? WEIGHT_MAX;
      return a.weight < wMin || a.weight > wMax;
    }).length,
  }), [alertsData, pagination.total_alerts, TEMP_MIN, TEMP_MAX, WEIGHT_MIN, WEIGHT_MAX]);

  const currentAlerts = activeTab === "active" ? alertsData.active : alertsData.resolved;
  const currentTotal = activeTab === "active" ? stats.totalActive : stats.totalResolved;

  // Determine problem type for display
  const getAlertProblems = (reading) => {
    const tempMin = reading.thresholds?.min_temperature ?? TEMP_MIN;
    const tempMax = reading.thresholds?.max_temperature ?? TEMP_MAX;
    const weightMin = reading.thresholds?.min_weight ?? WEIGHT_MIN;
    const weightMax = reading.thresholds?.max_weight ?? WEIGHT_MAX;

    const problems = [];
    if (reading.temperature < tempMin) problems.push({ type: "low-temp", label: "Low Temperature", value: `${reading.temperature}°C`, expected: `${tempMin}°C–${tempMax}°C`, icon: "🌡️", color: "#3b82f6" });
    if (reading.temperature > tempMax) problems.push({ type: "high-temp", label: "High Temperature", value: `${reading.temperature}°C`, expected: `${tempMin}°C–${tempMax}°C`, icon: "🌡️", color: "#ef4444" });
    if (reading.weight < weightMin) problems.push({ type: "low-weight", label: "Low Weight", value: `${reading.weight} kg`, expected: `${weightMin}–${weightMax} kg`, icon: "⚖️", color: "#f59e0b" });
    if (reading.weight > weightMax) problems.push({ type: "high-weight", label: "High Weight", value: `${reading.weight} kg`, expected: `${weightMin}–${weightMax} kg`, icon: "⚖️", color: "#8b5cf6" });
    return problems;
  };

  return (
    <div className="alerts-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <div className="header-icon-wrapper">
              <Bell size={24} />
            </div>
            <div>
              <h1>Alert Management</h1>
              <p>Monitor and resolve abnormal sensor conditions</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              Refresh
            </button>
            {hasActiveFilters && (
              <button className="btn btn-ghost" onClick={clearFilters}>
                <X size={16} /> Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="alerts-stats-grid">
        <div className="stat-card critical">
          <div className="stat-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalActive}</span>
            <span className="stat-label">Active Alerts</span>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">
            <CheckCircle size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalResolved}</span>
            <span className="stat-label">Resolved (24h)</span>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon" style={{background: "rgba(59,130,246,0.15)"}}>
            <span style={{fontSize: "18px"}}>🌡️</span>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.tempAlerts}</span>
            <span className="stat-label">Temperature Issues</span>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon" style={{background: "rgba(139,92,246,0.15)"}}>
            <span style={{fontSize: "18px"}}>⚖️</span>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.weightAlerts}</span>
            <span className="stat-label">Weight Issues</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="alerts-tabs">
        <button
          className={`tab-btn ${activeTab === "active" ? "active" : ""}`}
          onClick={() => { setActiveTab("active"); setPagination(prev => ({...prev, page: 1})); }}
        >
          <AlertTriangle size={16} />
          <span>Active Alerts</span>
          {stats.totalActive > 0 && <span className="tab-badge">{stats.totalActive}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === "resolved" ? "active" : ""}`}
          onClick={() => { setActiveTab("resolved"); setPagination(prev => ({...prev, page: 1})); }}
        >
          <CheckCircle size={16} />
          <span>Resolved Alerts</span>
          {stats.totalResolved > 0 && <span className="tab-badge">{stats.totalResolved}</span>}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="alerts-filter-bar">
        <div className="filter-group">
          <label className="filter-label">
            <Filter size={14} />
            <span>Filters</span>
          </label>
          <div className="filter-controls">
            <select
              className="filter-select"
              value={filters.status_filter || ""}
              onChange={(e) => handleFilterChange({ status_filter: e.target.value || null })}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Resolved">Resolved Only</option>
            </select>

            <input
              type="date"
              className="filter-date"
              value={filters.date_filter || ""}
              onChange={(e) => handleFilterChange({ date_filter: e.target.value || null })}
              placeholder="Filter by resolved date"
            />

            {activeTab === "resolved" && (
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.show_recent_resolved}
                  onChange={(e) => handleFilterChange({ show_recent_resolved: e.target.checked })}
                />
                <span>Last 24 hours only</span>
              </label>
            )}
          </div>
        </div>
        <div className="filter-results">
          Showing <strong>{currentAlerts.length}</strong> of <strong>{pagination.total_alerts}</strong> alerts
        </div>
      </div>

      {/* Alerts List */}
      <div className="alerts-list-container">
        {loading ? (
          <div className="alerts-loading">
            <div className="spinner"></div>
            <p>Loading alerts...</p>
          </div>
        ) : currentAlerts.length === 0 ? (
          <div className="alerts-empty">
            {activeTab === "active" ? (
              <>
                <div className="empty-icon">✅</div>
                <h3>No Active Alerts</h3>
                <p>All systems operating within normal parameters.</p>
              </>
            ) : (
              <>
                <div className="empty-icon">📋</div>
                <h3>No Resolved Alerts</h3>
                <p>Resolved alerts from the last 24 hours will appear here.</p>
              </>
            )}
          </div>
        ) : (
          <div className="alerts-list" role="list">
            {currentAlerts.map((reading) => {
              const problems = getAlertProblems(reading);
              const isResolved = reading.status === "Resolved";
              const savedUser = localStorage.getItem("visionshield_user");
              const isAdmin = savedUser && JSON.parse(savedUser).role === "Administrator";
              const detectedTime = formatDateTimeUTC(reading.detected_at);
              const relativeTime = formatRelativeTime(reading.detected_at);

              return (
                <article key={reading._id} className={`alert-card ${isResolved ? "resolved" : "active"}`}>
                  <div className="alert-card-header">
                    <div className="alert-status-badge">
                      {problems.map((p, i) => (
                        <span key={i} className="problem-badge" style={{backgroundColor: p.color + "20", color: p.color, borderColor: p.color + "40"}}>
                          {p.icon} {p.label}
                        </span>
                      ))}
                    </div>
                    <div className="alert-meta">
                      <span className={`status-indicator ${isResolved ? "resolved" : "active"}`}>
                        <span className="status-dot"></span>
                        {isResolved ? "Resolved" : "Active"}
                      </span>
                      <span className="alert-time">
                        <Clock size={12} /> {relativeTime}
                      </span>
                    </div>
                  </div>

                  <div className="alert-card-body">
                    <div className="alert-problems">
                      {problems.map((problem, idx) => (
                        <div key={idx} className="problem-item" style={{borderLeftColor: problem.color}}>
                          <div className="problem-header">
                            <span className="problem-icon">{problem.icon}</span>
                            <span className="problem-label">{problem.label}</span>
                          </div>
                          <div className="problem-values">
                            <span className="problem-current">Current: <strong>{problem.value}</strong></span>
                            <span className="problem-expected">Expected: {problem.expected}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="alert-details">
                      <div className="detail-item">
                        <span className="detail-label">Detected</span>
                        <span className="detail-value">{detectedTime}</span>
                      </div>
                      {isResolved && reading.resolved_at && (
                        <div className="detail-item">
                          <span className="detail-label">Resolved</span>
                          <span className="detail-value">{formatDateTimeUTC(reading.resolved_at)}</span>
                        </div>
                      )}
                      {isResolved && reading.resolved_by && (
                        <div className="detail-item">
                          <span className="detail-label">Resolved by</span>
                          <span className="detail-value">{reading.resolved_by}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isResolved && isAdmin && (
                    <div className="alert-card-actions">
                      <button
                        className="btn btn-primary resolve-btn"
                        onClick={() => handleResolveAlert(reading._id)}
                        disabled={resolvingId === reading._id}
                      >
                        {resolvingId === reading._id ? (
                          <>Resolving... <RefreshCw size={14} className="spin" /></>
                        ) : (
                          <>
                            <CheckCircle size={14} />
                            Resolve Alert
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {isResolved && (
                    <div className="alert-resolved-tag">
                      <CheckCircle size={14} /> Resolved
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && currentAlerts.length > 0 && pagination.total_pages > 1 && (
          <div className="alerts-pagination">
            <button
              className="pagination-btn"
              onClick={() => setPagination(prev => ({...prev, page: Math.max(1, prev.page - 1)}))}
              disabled={!pagination.has_prev}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <div className="pagination-info">
              Page {pagination.page} of {pagination.total_pages}
            </div>
            <button
              className="pagination-btn"
              onClick={() => setPagination(prev => ({...prev, page: Math.min(pagination.total_pages, prev.page + 1)}))}
              disabled={!pagination.has_next}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Alerts;
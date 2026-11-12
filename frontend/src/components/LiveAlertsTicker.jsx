import { useEffect, useState } from "react";
import { getAlerts } from "../data/sensorData";
import { AlertTriangle, CheckCircle, ChevronRight, ExternalLink } from "lucide-react";

function LiveAlertsTicker({ maxAlerts = 3 }) {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const data = await getAlerts(1, 20, "Active", null, false);
        const active = data.alerts.filter(a => a.status === "Active");
        setActiveAlerts(active.slice(0, maxAlerts));
      } catch (error) {
        console.error("Error fetching alerts:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [maxAlerts]);

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${diffHours}h ago`;
  };

  const getAlertType = (reading) => {
    const types = [];
    if (reading.temperature > (reading.thresholds?.max_temperature ?? 1600) ||
        reading.temperature < (reading.thresholds?.min_temperature ?? 1300)) {
      types.push({ label: "Temperature", icon: "🌡️", color: "#ef4444" });
    }
    if (reading.weight > (reading.thresholds?.max_weight ?? 650) ||
        reading.weight < (reading.thresholds?.min_weight ?? 500)) {
      types.push({ label: "Weight", icon: "⚖️", color: "#f59e0b" });
    }
    return types.length > 0 ? types[0] : { label: "Sensor", icon: "📊", color: "#6366f1" };
  };

  if (loading) {
    return (
      <div className="alerts-ticker loading">
        <div className="ticker-header">
          <span className="ticker-title">Active Alerts</span>
          <div className="ticker-loader"></div>
        </div>
      </div>
    );
  }

  if (activeAlerts.length === 0) {
    return (
      <div className="alerts-ticker empty">
        <div className="ticker-header">
          <span className="ticker-title">Active Alerts</span>
          <CheckCircle size={16} className="ticker-all-clear" />
        </div>
        <div className="ticker-empty">No active alerts — All systems normal</div>
      </div>
    );
  }

  return (
    <div className="alerts-ticker">
      <div className="ticker-header">
        <span className="ticker-title">
          <AlertTriangle size={16} /> Active Alerts
          <span className="ticker-count">{activeAlerts.length}</span>
        </span>
        <a href="/alerts" className="ticker-view-all">
          View All <ChevronRight size={12} />
        </a>
      </div>
      <div className="ticker-list">
        {activeAlerts.map((alert, idx) => {
          const alertType = getAlertType(alert);
          const relativeTime = formatRelativeTime(alert.detected_at);
          return (
            <div key={alert._id} className="ticker-item" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div className="ticker-item-icon" style={{ backgroundColor: alertType.color + "15", color: alertType.color }}>
                {alertType.icon}
              </div>
              <div className="ticker-item-content">
                <div className="ticker-item-main">
                  <span className="ticker-item-type">{alertType.label}</span>
                  <span className="ticker-item-severity">Critical</span>
                </div>
                <div className="ticker-item-details">
                  <span className="ticker-item-value">
                    {alertType.label === "Temperature"
                      ? `${alert.temperature}°C`
                      : `${alert.weight} kg`}
                  </span>
                  <span className="ticker-item-time">{relativeTime}</span>
                </div>
              </div>
              <ExternalLink size={14} className="ticker-item-link" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LiveAlertsTicker;
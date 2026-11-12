import { useEffect, useState } from "react";

import {
  Settings as SettingsIcon,
  Thermometer,
  RefreshCw,
  Server,
  Database,
  Save,
  RotateCcw,
  BellRing,
  Send,
  CheckCircle2,
  AlertCircle,
  Power
} from "lucide-react";
import { apiUrl, ENDPOINTS } from "../config/api";

function Settings() {
  // =========================================
  // Default Settings
  // =========================================

  const DEFAULT_SETTINGS = {
    system_name: "VisionShield",
    min_temperature: 1300,
    max_temperature: 1600,
    min_weight: 500,
    max_weight: 650,
    refresh_interval: 5,
    alert_email: "",
    alert_phone: "",
    enable_email_alerts: false,
    enable_sms_alerts: false,
    monitoring_enabled: false,
    process_alert_email: "",
  };

  // =========================================
  // State
  // =========================================

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSms, setTestingSms] = useState(false);
  const [testingProcessAlertEmail, setTestingProcessAlertEmail] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [togglingMonitor, setTogglingMonitor] = useState(false);

  // Get user role for admin-only fields
  const [userRole, setUserRole] = useState(() => {
    try {
      const savedUser = localStorage.getItem("visionshield_user");
      return savedUser ? JSON.parse(savedUser).role : null;
    } catch {
      return null;
    }
  });

  // =========================================
  // Load Settings
  // =========================================

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedUser = localStorage.getItem("visionshield_user");
        if (!savedUser) return;
        const user = JSON.parse(savedUser);

        const response = await fetch(apiUrl(ENDPOINTS.settings), {
          headers: {
            Authorization: `Bearer ${user.session_token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to load system settings.");
        }

        const data = await response.json();

        setSettings({
          system_name: data.system_name ?? DEFAULT_SETTINGS.system_name,
          min_temperature: data.min_temperature ?? DEFAULT_SETTINGS.min_temperature,
          max_temperature: data.max_temperature ?? DEFAULT_SETTINGS.max_temperature,
          min_weight: data.min_weight ?? DEFAULT_SETTINGS.min_weight,
          max_weight: data.max_weight ?? DEFAULT_SETTINGS.max_weight,
          refresh_interval: data.refresh_interval ?? DEFAULT_SETTINGS.refresh_interval,
          alert_email: data.alert_email ?? DEFAULT_SETTINGS.alert_email,
          alert_phone: data.alert_phone ?? DEFAULT_SETTINGS.alert_phone,
          enable_email_alerts: Boolean(data.enable_email_alerts),
          enable_sms_alerts: Boolean(data.enable_sms_alerts),
          monitoring_enabled: Boolean(data.monitoring_enabled),
          process_alert_email: data.process_alert_email ?? DEFAULT_SETTINGS.process_alert_email,
        });
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    }

    loadSettings();
  }, []);

  // =========================================
  // Handle Input Changes
  // =========================================

  const handleChange = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
    setMessage("");
    setError("");
    setTestResult(null);
  };

  // =========================================
  // Test Notification Dispatch
  // =========================================

  const handleTestAlert = async (type) => {
    setTestResult(null);

    // Determine destination based on type
    let destination = "";
    if (type === "email") {
      destination = settings.alert_email.trim();
    } else if (type === "sms") {
      destination = settings.alert_phone.trim();
    } else if (type === "process_alert_email") {
      destination = settings.process_alert_email.trim();
    }

    if (!destination) {
      const fieldName = type === "process_alert_email" ? "Process Alert Email" : (type === "email" ? "Email address" : "Mobile phone number");
      setError(`Please enter a valid ${fieldName} first.`);
      return;
    }

    const savedUser = localStorage.getItem("visionshield_user");
    if (!savedUser) {
      setError("User session not found.");
      return;
    }
    const user = JSON.parse(savedUser);

    try {
      if (type === "email") setTestingEmail(true);
      if (type === "sms") setTestingSms(true);
      if (type === "process_alert_email") setTestingProcessAlertEmail(true);
      setError("");

      // For process alert email, we use "email" as target_type but send to process_alert_email
      const targetType = type === "process_alert_email" ? "email" : type;

      const response = await fetch(apiUrl(ENDPOINTS.testNotification), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_token: user.session_token,
          target_type: targetType,
          destination: destination,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || `Failed to trigger ${type} test.`);
      }

      setTestResult({
        type,
        success: resData.success,
        detail: resData.detail,
      });
    } catch (err) {
      setTestResult({
        type,
        success: false,
        detail: err.message || "Failed to trigger test notification.",
      });
    } finally {
      if (type === "email") setTestingEmail(false);
      if (type === "sms") setTestingSms(false);
      if (type === "process_alert_email") setTestingProcessAlertEmail(false);
    }
  };

  // =========================================
  // Save Settings
  // =========================================

  const handleSave = async () => {
    setMessage("");
    setError("");
    setTestResult(null);

    const minTemperature = Number(settings.min_temperature);
    const maxTemperature = Number(settings.max_temperature);
    const minWeight = Number(settings.min_weight);
    const maxWeight = Number(settings.max_weight);
    const refreshInterval = Number(settings.refresh_interval);

    if (!settings.system_name.trim()) {
      setError("System name cannot be empty.");
      return;
    }

    if (
      !Number.isFinite(minTemperature) ||
      !Number.isFinite(maxTemperature) ||
      !Number.isFinite(minWeight) ||
      !Number.isFinite(maxWeight) ||
      !Number.isFinite(refreshInterval)
    ) {
      setError("Please enter valid numeric values.");
      return;
    }

    if (minTemperature >= maxTemperature) {
      setError("Minimum temperature must be less than maximum temperature.");
      return;
    }

    if (minWeight >= maxWeight) {
      setError("Minimum weight must be less than maximum weight.");
      return;
    }

    if (refreshInterval <= 0) {
      setError("Refresh interval must be greater than 0 seconds.");
      return;
    }

    try {
      setSaving(true);
      const savedUser = localStorage.getItem("visionshield_user");
      if (!savedUser) {
        throw new Error("User session not found.");
      }
      const user = JSON.parse(savedUser);

      const updatedSettings = {
        system_name: settings.system_name.trim(),
        min_temperature: minTemperature,
        max_temperature: maxTemperature,
        min_weight: minWeight,
        max_weight: maxWeight,
        refresh_interval: refreshInterval,
        session_token: user.session_token,
        alert_email: (settings.alert_email || "").trim(),
        alert_phone: (settings.alert_phone || "").trim(),
        enable_email_alerts: Boolean(settings.enable_email_alerts),
        enable_sms_alerts: Boolean(settings.enable_sms_alerts),
        monitoring_enabled: Boolean(settings.monitoring_enabled),
        process_alert_email: (settings.process_alert_email || "").trim(),
      };

      const response = await fetch(apiUrl(ENDPOINTS.settings), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update settings.");
      }

      setMessage("Settings and alert recipients updated successfully!");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update system settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setMessage("");
    setError("");
    setTestResult(null);
  };

  const getAuthUser = () => {
    const savedUser = localStorage.getItem("visionshield_user");
    if (!savedUser) {
      throw new Error("User session not found.");
    }
    return JSON.parse(savedUser);
  };

  const handleMonitoringToggle = async () => {
    setMessage("");
    setError("");
    setTestResult(null);

    const refreshInterval = Number(settings.refresh_interval);
    if (!Number.isFinite(refreshInterval) || refreshInterval <= 0) {
      setError("Refresh interval must be greater than 0 seconds.");
      return;
    }

    try {
      setTogglingMonitor(true);
      const user = getAuthUser();
      const nextEnabled = !settings.monitoring_enabled;

      const response = await fetch(apiUrl(ENDPOINTS.updateMonitoring), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_token: user.session_token,
          monitoring_enabled: nextEnabled,
          refresh_interval: refreshInterval,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || "Failed to update monitoring.");
      }

      setSettings((current) => ({
        ...current,
        monitoring_enabled: nextEnabled,
        refresh_interval: refreshInterval,
      }));

      setMessage(
        nextEnabled
          ? `Sensor monitoring started. New readings and alerts will run every ${refreshInterval} seconds.`
          : "Sensor monitoring stopped. No new sensor data will be ingested."
      );
    } catch (err) {
      setError(err.message || "Failed to update monitoring.");
    } finally {
      setTogglingMonitor(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <p>Configure operational parameters, sensor thresholds, and email or mobile alerts</p>
        </div>
      </div>

      {message && (
        <div className="settings-success-message">
          <CheckCircle2 size={18} /> {message}
        </div>
      )}

      {error && (
        <div className="settings-error-message">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* =========================================
          System Identification
      ========================================== */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <SettingsIcon size={20} />
          </div>
          <div>
            <h2>System Identification</h2>
            <p>Basic information about this VisionShield deployment</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="setting-item full-width">
            <label>System Name</label>
            <input
              type="text"
              value={settings.system_name}
              onChange={(e) => handleChange("system_name", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* =========================================
          Operational Thresholds
      ========================================== */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <Thermometer size={20} />
          </div>
          <div>
            <h2>Operational Thresholds</h2>
            <p>Save min/max temperature and weight. New readings are checked against these limits and stored with a timestamp</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="setting-item">
            <label>Minimum Temperature</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={settings.min_temperature}
                onChange={(e) => handleChange("min_temperature", e.target.value)}
              />
              <span>°C</span>
            </div>
          </div>

          <div className="setting-item">
            <label>Maximum Temperature</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={settings.max_temperature}
                onChange={(e) => handleChange("max_temperature", e.target.value)}
              />
              <span>°C</span>
            </div>
          </div>

          <div className="setting-item">
            <label>Minimum Weight</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={settings.min_weight}
                onChange={(e) => handleChange("min_weight", e.target.value)}
              />
              <span>kg</span>
            </div>
          </div>

          <div className="setting-item">
            <label>Maximum Weight</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={settings.max_weight}
                onChange={(e) => handleChange("max_weight", e.target.value)}
              />
              <span>kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          Data Monitoring
      ========================================== */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <RefreshCw size={20} />
          </div>
          <div>
            <h2>Data Monitoring</h2>
            <p>Set how often sensor data is ingested and start or stop live monitoring</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="setting-item">
            <label>Data Refresh Interval</label>
            <div className="input-with-unit">
              <input
                type="number"
                min="1"
                value={settings.refresh_interval}
                onChange={(e) => handleChange("refresh_interval", e.target.value)}
              />
              <span>seconds</span>
            </div>
          </div>

          <div className="setting-item">
            <label>Live Sensor Feed</label>
            <button
              type="button"
              className={`monitoring-toggle-btn ${settings.monitoring_enabled ? "is-on" : ""}`}
              onClick={handleMonitoringToggle}
              disabled={togglingMonitor}
            >
              <Power size={16} />
              {togglingMonitor
                ? "Updating..."
                : settings.monitoring_enabled
                  ? "Monitoring ON"
                  : "Monitoring OFF"}
            </button>
            <p className="monitoring-toggle-hint">
              {settings.monitoring_enabled
                ? `Sensor data is being collected every ${settings.refresh_interval} seconds. Alerts are created when values leave the operational thresholds.`
                : "Turn this on to collect sensor data at the interval above and generate alerts when thresholds are exceeded."}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================
          Alert Notifications
      ========================================== */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <BellRing size={20} />
          </div>
          <div>
            <h2>Alert Notifications</h2>
            <p>Receive alerts for process violations, skipped steps, and sensor anomalies</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="setting-item">
            <label htmlFor="alert-email">Alert Email Address</label>
            <input
              id="alert-email"
              type="email"
              placeholder="supervisor@plant.com"
              value={settings.alert_email}
              onChange={(e) => handleChange("alert_email", e.target.value)}
            />
            <div className="setting-item-actions">
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={settings.enable_email_alerts}
                  onChange={(e) => handleChange("enable_email_alerts", e.target.checked)}
                />
                <span className="settings-switch-track" />
                Enable email alerts
              </label>

              <button
                type="button"
                className="settings-reset-btn settings-test-btn"
                disabled={testingEmail || !settings.alert_email}
                onClick={() => handleTestAlert("email")}
              >
                <Send size={15} /> {testingEmail ? "Sending..." : "Test Email"}
              </button>
            </div>
          </div>

          <div className="setting-item">
            <label htmlFor="alert-phone">Alert Mobile Number</label>
            <input
              id="alert-phone"
              type="tel"
              placeholder="+919876543210"
              value={settings.alert_phone}
              onChange={(e) => handleChange("alert_phone", e.target.value)}
            />
            <div className="setting-item-actions">
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={settings.enable_sms_alerts}
                  onChange={(e) => handleChange("enable_sms_alerts", e.target.checked)}
                />
                <span className="settings-switch-track" />
                Enable SMS alerts
              </label>

              <button
                type="button"
                className="settings-reset-btn settings-test-btn"
                disabled={testingSms || !settings.alert_phone}
                onClick={() => handleTestAlert("sms")}
              >
                <Send size={15} /> {testingSms ? "Sending..." : "Test SMS"}
              </button>
            </div>
          </div>
        </div>

        {/* Process Detection Alert Email (Admin Only) */}
        {userRole === "Administrator" && (
          <div className="setting-item">
            <label htmlFor="process-alert-email">
              Process Detection Alert Email (Default)
              <span className="admin-badge">ADMIN ONLY</span>
            </label>
            <input
              id="process-alert-email"
              type="email"
              placeholder="supervisor@plant.com (receives magnesium skip alerts)"
              value={settings.process_alert_email}
              onChange={(e) => handleChange("process_alert_email", e.target.value)}
            />
            <div className="setting-item-actions">
              <button
                type="button"
                className="settings-reset-btn settings-test-btn"
                disabled={testingProcessAlertEmail || !settings.process_alert_email}
                onClick={() => handleTestAlert("process_alert_email")}
              >
                <Send size={15} /> {testingProcessAlertEmail ? "Sending..." : "Test Process Alert Email"}
              </button>
            </div>
            <p className="setting-help-text">
              Automatic email sent when magnesium process is skipped during process detection.
              Separate from sensor threshold alerts above.
            </p>
          </div>
        )}

        {testResult && (
          <div
            className={
              testResult.success
                ? "settings-success-message settings-test-result"
                : "settings-error-message settings-test-result"
            }
          >
            {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>
              {testResult.type === "sms" ? "SMS" : "Email"} test: {testResult.detail}
            </span>
          </div>
        )}
      </div>

      {/* =========================================
          System Information
      ========================================== */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <Server size={20} />
          </div>
          <div>
            <h2>System Information</h2>
            <p>Current VisionShield system status</p>
          </div>
        </div>

        <div className="system-info-grid">
          <div className="system-info-item">
            <Server size={18} />
            <div>
              <span>Backend</span>
              <strong>Connected</strong>
            </div>
          </div>

          <div className="system-info-item">
            <Database size={18} />
            <div>
              <span>Database</span>
              <strong>MongoDB Connected</strong>
            </div>
          </div>

          <div className="system-info-item">
            <SettingsIcon size={18} />
            <div>
              <span>Version</span>
              <strong>VisionShield v1.0</strong>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          Action Buttons
      ========================================== */}
      <div className="settings-actions">
        <button className="settings-reset-btn" onClick={handleReset} disabled={saving}>
          <RotateCcw size={17} /> Reset
        </button>

        <button className="settings-save-btn" onClick={handleSave} disabled={saving}>
          <Save size={17} /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default Settings;

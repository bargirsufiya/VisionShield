import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, User, Lock, Zap, Gauge, Activity, Shield } from "lucide-react";
import { apiUrl, ENDPOINTS } from "../config/api";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        apiUrl(ENDPOINTS.login),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed.");
      }
      onLogin({
        username: data.username,
        role: data.role,
        session_token: data.session_token,
      });

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Industrial metric cards data for left panel
  const metrics = [
    { label: "SYSTEM UPTIME", value: "99.97%", icon: Activity, color: "cyan", trend: "+0.02%" },
    { label: "ACTIVE SENSORS", value: "247", icon: Gauge, color: "cyan", trend: "+3" },
    { label: "CRITICAL ALERTS", value: "0", icon: Shield, color: "emerald", trend: "—" },
    { label: "POWER EFFICIENCY", value: "94.2%", icon: Zap, color: "amber", trend: "+1.1%" },
  ];

  return (
    <div className="login-page-split">
      {/* LEFT PANEL - Industrial Dashboard */}
      <div className="login-left-panel">
        <div className="login-left-bg" style={{ backgroundImage: 'url("/images/login-foundry.jpeg")' }} />
        <div className="login-left-overlay" />

        <div className="login-left-content">
          {/* Header branding */}
          <div className="login-left-header">
            <div className="login-left-logo">
              <ShieldCheck size={36} />
            </div>
            <div className="login-left-brand">
              <h1>VisionShield</h1>
              <span className="login-left-tagline">INDUSTRIAL MONITORING SYSTEM</span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="login-left-status">
            <span className="status-pulse" />
            <span>SYSTEM ONLINE</span>
            <span className="status-version">v2.4.1</span>
          </div>

          {/* Metric Cards Grid */}
          <div className="login-metrics-grid">
            {metrics.map((metric, index) => (
              <div key={index} className={`login-metric-card ${metric.color}`} style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="metric-icon">
                  <metric.icon size={22} />
                </div>
                <div className="metric-content">
                  <div className="metric-value">{metric.value}</div>
                  <div className="metric-label">{metric.label}</div>
                  <div className="metric-trend">{metric.trend}</div>
                </div>
                <div className="metric-accent" />
              </div>
            ))}
          </div>

          {/* Footer info */}
          <div className="login-left-footer">
            <div className="footer-item">
              <span className="footer-label">NEXT MAINTENANCE</span>
              <span className="footer-value">72 HOURS</span>
            </div>
            <div className="footer-divider" />
            <div className="footer-item">
              <span className="footer-label">FIRMWARE</span>
              <span className="footer-value">4.2.18</span>
            </div>
            <div className="footer-divider" />
            <div className="footer-item">
              <span className="footer-label">SECURITY LEVEL</span>
              <span className="footer-value">MIL-SPEC</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Login Form */}
      <div className="login-right-panel">
        <div className="login-right-content">
          {/* Logo */}
          <div className="login-right-logo">
            <ShieldCheck size={48} />
          </div>

          <h1 className="login-right-title">VisionShield</h1>
          <p className="login-right-subtitle">AI-Powered Industrial Monitoring</p>

          <div className="login-right-divider">
            <span className="divider-line" />
            <span className="divider-text">AUTHORIZED ACCESS ONLY</span>
            <span className="divider-line" />
          </div>

          <h2 className="login-right-heading">Sign In</h2>
          <p className="login-right-description">
            Enter your credentials to access the VisionShield monitoring dashboard.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            {/* Username */}
            <div className="login-field">
              <label htmlFor="username">Username</label>
              <div className="login-input-wrapper">
                <User size={18} />
                <input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-input-wrapper">
                <Lock size={18} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            {/* Login button */}
            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner" />
                  <span>Authenticating...</span>
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="login-right-footer">
            <span className="footer-dot" />
            <span>VisionShield Industrial Systems</span>
            <span className="footer-dot" />
            <span>Secure Connection</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
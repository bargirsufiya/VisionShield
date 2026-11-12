// API Configuration
// Change this to match your backend port
export const API_BASE_URL = "http://127.0.0.1:8000";

// Helper to build full API URLs
export const apiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;

// Common endpoints
export const ENDPOINTS = {
  // Auth
  login: "/api/auth/login",
  setupAdmin: "/api/auth/setup",
  getUsers: "/api/auth/users",
  createUser: "/api/auth/users",
  updateUserRole: "/api/auth/users/role",
  updateUserStatus: "/api/auth/users/status",
  resetUserPassword: "/api/auth/users/password",

  // Sensors & Alerts
  sensors: "/api/sensors",
  sensorsHistory: "/api/sensors/history",
  alerts: "/api/alerts",
  resolveAlert: "/api/alerts/resolve",

  // Settings
  settings: "/api/settings",
  settingsRuntime: "/api/settings/runtime",
  testNotification: "/api/test-notification",
  updateMonitoring: "/api/settings/monitoring",

  // AI Detection
  aiDetect: "/api/ai/detect",
  aiVideoDetect: "/api/ai/video-detect",
  aiVideoResult: (filename) => `/api/ai/video-result/${filename}`,
  aiResult: (filename) => `/api/ai/result/${filename}`,

  // Process Detection
  processVideoDetect: "/api/process/video-detect",
  processStatus: (jobId) => `/api/process/status/${jobId}`,
  processResult: (jobId) => `/api/process/result/${jobId}`,
  processVideoResult: (filename) => `/api/process/video-result/${filename}`,
  processJobs: "/api/process/jobs",
  processDownloadReport: (jobId) => `/api/process/download-report/${jobId}`,
  processCancel: (jobId) => `/api/process/cancel/${jobId}`,

  // Database test
  databaseTest: "/api/database-test",
  test: "/api/test",

  // Reports
  dailyReport: "/api/reports/daily",

  // Maintenance Management
  maintenance: "/api/maintenance",
  maintenanceById: (id) => `/api/maintenance/${id}`,
  maintenanceComplete: (id) => `/api/maintenance/${id}/complete`,
  maintenanceStats: "/api/maintenance/stats/summary",
};
import { apiUrl, ENDPOINTS } from "../config/api";

export const DEFAULT_RANGES = {
  min_temperature: 1300,
  max_temperature: 1600,
  min_weight: 500,
  max_weight: 650,
  refresh_interval: 5,
  monitoring_enabled: false,
};

export async function getRuntimeSettings() {
  const response = await fetch(apiUrl(ENDPOINTS.settingsRuntime));

  if (!response.ok) {
    throw new Error("Failed to fetch runtime settings");
  }

  return await response.json();
}

export async function getSensorData(page = 1, limit = 10, search = "") {
  const response = await fetch(
    apiUrl(`${ENDPOINTS.sensors}?page=${page}&limit=${limit}&search=${search}`)
  );

  if (!response.ok) {
    throw new Error("Failed to fetch sensor data");
  }

  return await response.json();
}

export async function getSensorHistory(date, page = 1, limit = 1000) {
  const response = await fetch(
    apiUrl(`${ENDPOINTS.sensorsHistory}?date=${date}&page=${page}&limit=${limit}`)
  );

  if (!response.ok) {
    throw new Error("Failed to fetch historical sensor data");
  }

  return await response.json();
}

export async function getAlerts(page = 1, limit = 10, statusFilter = null, dateFilter = null, showRecentResolved = true) {
  // Build query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    show_recent_resolved: showRecentResolved.toString()
  });

  // Add optional filters if provided
  if (statusFilter) {
    queryParams.append('status_filter', statusFilter);
  }

  if (dateFilter) {
    queryParams.append('date_filter', dateFilter);
  }

  const response = await fetch(
    apiUrl(`${ENDPOINTS.alerts}?${queryParams.toString()}`)
  );

  if (!response.ok) {
    throw new Error("Failed to fetch alerts");
  }

  return await response.json();
}

export async function resolveAlert(alertId, adminToken) {
  const response = await fetch(
    apiUrl(ENDPOINTS.resolveAlert),
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        alert_id: alertId,
        admin_token: adminToken,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();

    throw new Error(
      errorData.detail || "Failed to resolve alert"
    );
  }

  return await response.json();
}

export async function downloadDailyReport(date) {
  const response = await fetch(
    apiUrl(`${ENDPOINTS.dailyReport}?date=${date}`)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || "Failed to generate daily report"
    );
  }

  // Return blob for PDF download
  return await response.blob();
}
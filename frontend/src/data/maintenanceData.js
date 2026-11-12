import { apiUrl, ENDPOINTS } from "../config/api";

export async function getMaintenanceRecords(page = 1, limit = 10, search = "", statusFilter = null) {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });

  if (search) {
    queryParams.append('search', search);
  }

  if (statusFilter && statusFilter !== "All") {
    queryParams.append('status_filter', statusFilter);
  }

  const response = await fetch(
    apiUrl(`${ENDPOINTS.maintenance}?${queryParams.toString()}`)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch maintenance records");
  }

  return await response.json();
}

export async function getMaintenanceRecord(id) {
  const response = await fetch(
    apiUrl(ENDPOINTS.maintenanceById(id))
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch maintenance record");
  }

  return await response.json();
}

export async function createMaintenanceRecord(data, adminToken) {
  const response = await fetch(
    apiUrl(ENDPOINTS.maintenance),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
        admin_token: adminToken,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create maintenance record");
  }

  return await response.json();
}

export async function updateMaintenanceRecord(id, data, adminToken) {
  const response = await fetch(
    apiUrl(ENDPOINTS.maintenanceById(id)),
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
        admin_token: adminToken,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update maintenance record");
  }

  return await response.json();
}

export async function completeMaintenanceRecord(id, data, adminToken) {
  const response = await fetch(
    apiUrl(ENDPOINTS.maintenanceComplete(id)),
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
        admin_token: adminToken,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to complete maintenance record");
  }

  return await response.json();
}

export async function deleteMaintenanceRecord(id, adminToken) {
  const response = await fetch(
    apiUrl(ENDPOINTS.maintenanceById(id)),
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admin_token: adminToken,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to delete maintenance record");
  }

  return await response.json();
}

export async function getMaintenanceStats() {
  const response = await fetch(
    apiUrl(ENDPOINTS.maintenanceStats)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch maintenance stats");
  }

  return await response.json();
}
const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:8000/api`;
  }
  return 'http://localhost:8000/api';
};

const API_BASE = import.meta.env.VITE_API_BASE || getApiBase();

export function getStoredToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('dataforge_token');
  }
  return null;
}

export function setStoredToken(token) {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('dataforge_token', token);
    } else {
      localStorage.removeItem('dataforge_token');
    }
  }
}

function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res, defaultErrorMsg = 'Request failed') {
  if (!res.ok) {
    let errorMsg = defaultErrorMsg;
    try {
      const err = await res.json();
      errorMsg = err.detail || defaultErrorMsg;
    } catch {
      try {
        const text = await res.text();
        errorMsg = text || `${defaultErrorMsg} (Status ${res.status})`;
      } catch {
        errorMsg = `${defaultErrorMsg} (Status ${res.status})`;
      }
    }
    const error = new Error(errorMsg);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

// Authentication
export async function loginUser(credentials) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const data = await handleResponse(res, 'Authentication failed');
  if (data && data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function fetchCurrentUser() {
  const token = getStoredToken();
  if (!token) {
    throw new Error('No authentication token found');
  }
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Session expired. Please log in again.');
}

export async function logoutUser() {
  try {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await handleResponse(res, 'Logout failed');
  } catch (err) {
    console.warn('Logout network/server notice:', err);
    return { success: false, message: err.message };
  } finally {
    setStoredToken(null);
  }
}

// System Stats
export async function fetchStats() {
  const res = await fetch(`${API_BASE}/tables/stats`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to load system statistics');
}

// Users (Admin rights enforced)
export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch users');
}

export async function createUser(userData) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(userData),
  });
  return handleResponse(res, 'Failed to create user');
}

export async function deleteUser(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to delete user');
}

// File Uploads
export async function uploadFiles(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload/csv`);
    const token = getStoredToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent, event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          resolve({ success: true });
        }
      } else {
        let errorMsg = 'Failed to process CSV files';
        try {
          const err = JSON.parse(xhr.responseText);
          errorMsg = err.detail || errorMsg;
        } catch {
          if (xhr.responseText) {
            errorMsg = xhr.responseText;
          }
        }
        const error = new Error(errorMsg);
        error.status = xhr.status;
        reject(error);
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          `Unable to reach backend API at ${API_BASE}. Please ensure the backend server is running on port 8000.`
        )
      );
    };

    xhr.send(formData);
  });
}

export async function uploadChunk(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload/chunk`);
    const token = getStoredToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent, event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({ success: true });
        }
      } else {
        let errorMsg = 'Failed to upload file chunk';
        try {
          const err = JSON.parse(xhr.responseText);
          errorMsg = err.detail || errorMsg;
        } catch {}
        const error = new Error(errorMsg);
        error.status = xhr.status;
        reject(error);
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          `Unable to reach backend API at ${API_BASE}. Please ensure the backend server is running on port 8000.`
        )
      );
    };

    xhr.send(formData);
  });
}

export async function completeChunkedUpload(payload) {
  try {
    const res = await fetch(`${API_BASE}/upload/chunk/complete`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    return await handleResponse(res, 'Failed to finalize chunked upload');
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach backend API at ${API_BASE}. Please ensure the backend server is running on port 8000.`
      );
    }
    throw err;
  }
}

// Tables & Schemas
export async function fetchTables() {
  const res = await fetch(`${API_BASE}/tables`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch warehouse tables');
}

export async function fetchTablePreview(tableName, limit = 50, offset = 0) {
  const res = await fetch(`${API_BASE}/tables/${tableName}/preview?limit=${limit}&offset=${offset}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, `Failed to load data for ${tableName}`);
}

export async function fetchTableAnalytics(tableName, metricCol = null, categoryCol = null, dateCol = null) {
  const params = new URLSearchParams();
  if (metricCol) params.append('metric_column', metricCol);
  if (categoryCol) params.append('category_column', categoryCol);
  if (dateCol) params.append('date_column', dateCol);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/tables/${tableName}/analytics${qs}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, `Failed to fetch analytics for ${tableName}`);
}

export async function fetchCrossTableAnalytics(payload) {
  const res = await fetch(`${API_BASE}/tables/cross-analytics`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to fetch cross-table analytics');
}

export async function fetchRelationships() {
  const res = await fetch(`${API_BASE}/tables/relationships`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch schema relationships');
}

export async function fetchSuggestedQueries() {
  const res = await fetch(`${API_BASE}/tables/suggested-queries`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function executeSql(query) {
  const res = await fetch(`${API_BASE}/tables/query`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query }),
  });
  return handleResponse(res, 'Query execution failed');
}

export async function executeAiQuery(prompt, tableName = null) {
  const res = await fetch(`${API_BASE}/tables/ai-query`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prompt, table_name: tableName }),
  });
  return handleResponse(res, 'AI query execution failed');
}

export async function deleteTable(tableName) {
  const res = await fetch(`${API_BASE}/tables/${tableName}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to delete table');
}

export async function resetWarehouse() {
  const res = await fetch(`${API_BASE}/tables/all`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to reset warehouse');
}

export async function generateAiDashboard(prompt = '', focusTable = null) {
  const res = await fetch(`${API_BASE}/tables/ai-dashboard`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prompt, focus_table: focusTable }),
  });
  return handleResponse(res, 'Failed to generate AI Dashboard');
}

export async function downloadDashboardHtml(dashboardData) {
  const res = await fetch(`${API_BASE}/tables/ai-dashboard/export-html`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ dashboard: dashboardData }),
  });
  if (!res.ok) {
    throw new Error('Failed to export AI Dashboard HTML');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  const filename = `DataForge_AI_Dashboard_${new Date().toISOString().slice(0, 10)}.html`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function fetchApiData(payload) {
  const res = await fetch(`${API_BASE}/upload/fetch-api`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to fetch and ingest API data');
}

export async function fetchPredictiveCandidates(tableName) {
  const res = await fetch(`${API_BASE}/predictive/candidates/${encodeURIComponent(tableName)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, `Failed to fetch candidate columns for table ${tableName}`);
}

export async function generateForecast(payload) {
  const res = await fetch(`${API_BASE}/predictive/forecast`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to generate predictive forecast');
}

// Executive Deck & Reporting Exporter
export async function exportPowerPointDeck(payload) {
  const res = await fetch(`${API_BASE}/reports/deck/export-pptx`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to generate PowerPoint presentation deck');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  const filename = `DataForge_Executive_Deck_${payload.table_name || 'dataset'}_${new Date().toISOString().slice(0, 10)}.pptx`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Proactive Anomaly Watchdog & Alerts
export async function scanTableAnomalies(tableName, metricColumn = null, dateColumn = null) {
  const params = new URLSearchParams();
  if (metricColumn) params.append('metric_column', metricColumn);
  if (dateColumn) params.append('date_column', dateColumn);
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/alerts/scan/${encodeURIComponent(tableName)}${queryStr}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, `Failed to scan anomalies for ${tableName}`);
}

export async function fetchAlertRules() {
  const res = await fetch(`${API_BASE}/alerts/rules`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch alert rules');
}

export async function createAlertRule(ruleData) {
  const res = await fetch(`${API_BASE}/alerts/rules`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(ruleData),
  });
  return handleResponse(res, 'Failed to create alert rule');
}

export async function deleteAlertRule(ruleId) {
  const res = await fetch(`${API_BASE}/alerts/rules/${ruleId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to delete alert rule');
}

export async function testAlertDispatch(payload) {
  const res = await fetch(`${API_BASE}/alerts/test-dispatch`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to trigger test alert dispatch');
}

export async function fetchAlertHistory() {
  const res = await fetch(`${API_BASE}/alerts/history`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch alert incident history');
}

// Multi-Tenant Workspaces
export async function fetchWorkspaces() {
  const res = await fetch(`${API_BASE}/workspaces`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch workspaces');
}

export async function createWorkspace(data) {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Failed to create workspace');
}

// Live Database Connectors & Remote Sync
export async function fetchDatabaseConnections(workspaceId = 1) {
  const res = await fetch(`${API_BASE}/connectors?workspace_id=${workspaceId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch database connections');
}

export async function testDatabaseConnection(connData) {
  const res = await fetch(`${API_BASE}/connectors/test`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(connData),
  });
  return handleResponse(res, 'Failed to test database connection');
}

export async function saveDatabaseConnection(connData) {
  const res = await fetch(`${API_BASE}/connectors`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(connData),
  });
  return handleResponse(res, 'Failed to save database connection');
}

export async function deleteDatabaseConnection(connId) {
  const res = await fetch(`${API_BASE}/connectors/${connId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to delete database connection');
}

export async function inspectDatabaseTables(connData) {
  const res = await fetch(`${API_BASE}/connectors/tables`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(connData),
  });
  return handleResponse(res, 'Failed to inspect remote tables');
}

export async function syncDatabaseTable(syncData) {
  const res = await fetch(`${API_BASE}/connectors/sync`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(syncData),
  });
  return handleResponse(res, 'Failed to sync database table to warehouse');
}

// Digital Twin Monte Carlo Simulation
export async function runDigitalTwinSimulation(payload) {
  const res = await fetch(`${API_BASE}/predictive/simulate`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Simulation run failed');
}

// Conversational AI Copilot
export async function chatWithCopilot(query, history = []) {
  const res = await fetch(`${API_BASE}/copilot/chat`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query, history }),
  });
  return handleResponse(res, 'Copilot processing failed');
}

export async function executeCopilotSql(sql) {
  const res = await fetch(`${API_BASE}/copilot/execute-sql`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sql }),
  });
  return handleResponse(res, 'SQL execution failed');
}

export async function fetchCopilotPrompts() {
  const res = await fetch(`${API_BASE}/copilot/prompts`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

// Extended Workspace Management
export async function deleteWorkspace(workspaceId) {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to delete workspace');
}

export async function fetchWorkspaceMembers(workspaceId) {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to fetch workspace members');
}

export async function addWorkspaceMember(workspaceId, memberData) {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(memberData),
  });
  return handleResponse(res, 'Failed to add workspace member');
}

export async function removeWorkspaceMember(workspaceId, memberId) {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members/${memberId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to remove member');
}

// ==========================================
// Customer 360 & Growth Intelligence APIs
// ==========================================

export async function fetchCustomerCandidates(tableName) {
  const res = await fetch(`${API_BASE}/customers/candidates/${tableName}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Failed to detect customer candidates');
}

export async function fetchRFMAnalysis(params) {
  const res = await fetch(`${API_BASE}/customers/rfm`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  return handleResponse(res, 'Failed to compute RFM customer segmentation');
}

export async function fetchCohortRetention(params) {
  const res = await fetch(`${API_BASE}/customers/cohorts`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  return handleResponse(res, 'Failed to compute cohort retention matrix');
}


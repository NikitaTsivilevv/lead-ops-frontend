const API_BASE = (typeof window !== 'undefined' && window.__LEAD_OPS_API_BASE)
  || 'https://lead-ops-api-h67zx.ondigitalocean.app';

const TOKEN_KEY = 'leadops_jwt';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try { payload = await res.json(); } catch {}

  if (!res.ok) {
    const err = new Error(payload?.message || payload?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

export const apiClient = {
  getToken,
  setToken,
  // auth
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),
  createUser: (data) => request('/api/auth/users', { method: 'POST', body: data }),
  // leads / appointments
  submitLead: (data) => request('/api/leads', { method: 'POST', body: data }),
  listAppointments: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '')
    ).toString();
    return request(`/api/appointments${qs ? `?${qs}` : ''}`);
  },
  getAppointment: (id) => request(`/api/appointments/${id}`),
  setQualification: (id, body) => request(`/api/appointments/${id}/qualification`, { method: 'PATCH', body }),
  addConfirmation: (id, body) => request(`/api/appointments/${id}/confirmations`, { method: 'POST', body }),
  setClientDecision: (id, body) => request(`/api/appointments/${id}/client-decision`, { method: 'PATCH', body }),
  setOutcome: (id, body) => request(`/api/appointments/${id}/outcome`, { method: 'PATCH', body }),
  redistribute: (id, body) => request(`/api/appointments/${id}/redistribute`, { method: 'POST', body }),
  setAdminPayout: (id, body) => request(`/api/appointments/${id}/admin`, { method: 'PATCH', body }),
  listMyLeads: () => request('/api/leads/my'),
  getAppointmentHistory: (appointmentId) => request(`/api/appointments/${appointmentId}/history`),
  // availability / calendar
  getAvailability: (clientId) => request(`/api/availability${clientId ? `?client_id=${clientId}` : ''}`),
  putAvailability: (body) => request('/api/availability', { method: 'PUT', body }),
  getCalendar: ({ from, to, client_id, view }) => {
    const qs = new URLSearchParams(
      Object.entries({ from, to, client_id, view }).filter(([, v]) => v !== null && v !== undefined && v !== '')
    ).toString();
    return request(`/api/calendar?${qs}`);
  },
};
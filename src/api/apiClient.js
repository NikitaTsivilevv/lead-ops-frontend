const API_BASE = (typeof window !== 'undefined' && window.__LEAD_OPS_API_BASE)
  || (import.meta.env.DEV ? '' : 'https://lead-ops-api-h67zx.ondigitalocean.app');

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
  rescheduleAppointment: (id, isoDate) => request(`/api/appointments/${id}`, { method: 'PATCH', body: { appointment_at: isoDate } }),
  redistribute: (id, body) => request(`/api/appointments/${id}/redistribute`, { method: 'POST', body }),
  setAdminPayout: (id, body) => request(`/api/appointments/${id}/admin`, { method: 'PATCH', body }),
  listMyLeads: () => request('/api/leads/my'),
  updateMyLead: (id, body) => request(`/api/leads/my/${id}`, { method: 'PATCH', body }),
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
  // agents (callers)
  listAgents: (clientId) =>
    request(`/api/agents${clientId ? `?client_id=${clientId}` : ''}`),
  createAgent: (body) => request('/api/agents', { method: 'POST', body }),
  updateAgent: (id, body) => request(`/api/agents/${id}`, { method: 'PATCH', body }),
  // callers (for intake dropdown)
  listCallers: () => request('/api/callers'),
  // clients
  listClients: () => request('/api/clients'),
  createClient: (body) => request('/api/clients', { method: 'POST', body }),
  updateClient: (id, body) => request(`/api/clients/${id}`, { method: 'PATCH', body }),
};
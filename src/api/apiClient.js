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
  acceptInvite: (data) => request('/api/auth/accept-invite', { method: 'POST', body: data }),
  getInviteByToken: (token) => request(`/api/auth/invites/${encodeURIComponent(token)}`),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  getResetTokenStatus: (token) => request(`/api/auth/reset-tokens/${encodeURIComponent(token)}`),
  resetPassword: (token, new_password) => request('/api/auth/reset-password', { method: 'POST', body: { token, new_password } }),
  listUsers: () => request('/api/auth/users'),
  inviteUser: (data) => request('/api/auth/invites', { method: 'POST', body: data }),
  updateUser: (id, body) => request(`/api/auth/users/${id}`, { method: 'PATCH', body }),
  disableUser: (id) => request(`/api/auth/users/${id}/disable`, { method: 'POST' }),
  resendInvite: (id) => request(`/api/auth/users/${id}/resend-invite`, { method: 'POST' }),
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
  updateLeadInfo: (id, body) => request(`/api/appointments/${id}/lead-info`, { method: 'PATCH', body }),
  addConfirmation: (id, body) => request(`/api/appointments/${id}/confirmations`, { method: 'POST', body }),
  setClientDecision: (id, body) => request(`/api/appointments/${id}/client-decision`, { method: 'PATCH', body }),
  setOutcome: (id, body) => request(`/api/appointments/${id}/outcome`, { method: 'PATCH', body }),
  rescheduleAppointment: (id, isoDate) => request(`/api/appointments/${id}`, { method: 'PATCH', body: { appointment_at: isoDate } }),
  redistribute: (id, body) => request(`/api/appointments/${id}/redistribute`, { method: 'POST', body }),
  setAdminPayout: (id, body) => request(`/api/appointments/${id}/admin`, { method: 'PATCH', body }),
  setRecordingVisibility: (id, allowed) => request(`/api/appointments/${id}/recording-visibility`, { method: 'PATCH', body: { allowed } }),
  getActionNeeded: () => request('/api/appointments/action-needed').then((d) => d.appointments || []),
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
  // callers (for intake dropdown + admin management)
  listCallers: () => request('/api/callers'),
  retireCaller: (id) => request(`/api/auth/users/${id}`, { method: 'PATCH', body: { action: 'retire' } }),
  // payroll profiles + assignments (Phase 2 C1)
  getPayrollProfile: (callerId) => request(`/api/callers/${callerId}/payroll-profile`),
  putPayrollProfile: (callerId, body) => request(`/api/callers/${callerId}/payroll-profile`, { method: 'PUT', body }),
  listCallerAssignments: (callerId) =>
    request(`/api/caller-assignments${callerId ? `?caller_id=${callerId}` : ''}`),
  createCallerAssignment: (body) => request('/api/caller-assignments', { method: 'POST', body }),
  closeCallerAssignment: (id, end_date) => request(`/api/caller-assignments/${id}`, { method: 'PATCH', body: { end_date } }),
  // attendance + cost (Phase 2 C2)
  listCallerAttendance: ({ caller_id, from, to }) =>
    request(`/api/caller-attendance?caller_id=${caller_id}&from=${from}&to=${to}`),
  recordAttendance: (body) => request('/api/caller-attendance', { method: 'POST', body }),
  deleteAttendance: ({ caller_id, work_date }) =>
    request(`/api/caller-attendance?caller_id=${caller_id}&work_date=${work_date}`, { method: 'DELETE' }),
  getPayrollCost: ({ client_id, from, to }) => {
    const qs = new URLSearchParams(
      Object.entries({ client_id, from, to }).filter(([, v]) => v != null && v !== '')
    ).toString();
    return request(`/api/payroll/cost?${qs}`);
  },
  getCallerCredit: ({ caller_id, year, month }) =>
    request(`/api/payroll/caller-credit?caller_id=${caller_id}&year=${year}&month=${month}`),
  // clients
  listClients: () => request('/api/clients'),
  createClient: (body) => request('/api/clients', { method: 'POST', body }),
  updateClient: (id, body) => request(`/api/clients/${id}`, { method: 'PATCH', body }),
  // managerial expenses (Phase 2 C3)
  listManagerialExpenses: () => request('/api/managerial-expenses'),
  getManagerialExpense: (year, month) => request(`/api/managerial-expenses?year=${year}&month=${month}`),
  upsertManagerialExpense: (body) => request('/api/managerial-expenses', { method: 'POST', body }),
  updateManagerialExpense: (id, body) => request(`/api/managerial-expenses/${id}`, { method: 'PUT', body }),
  // campaign expenses (Phase 2 D)
  listCampaignExpenses: ({ client_id, from, to, category } = {}) => {
    const qs = new URLSearchParams(
      Object.entries({ client_id, from, to, category }).filter(([, v]) => v != null && v !== '')
    ).toString();
    return request(`/api/campaign-expenses${qs ? `?${qs}` : ''}`);
  },
  getCampaignExpenseSummary: ({ from, to }) =>
    request(`/api/campaign-expenses/summary?from=${from}&to=${to}`),
  createCampaignExpense: (body) => request('/api/campaign-expenses', { method: 'POST', body }),
  updateCampaignExpense: (id, body) => request(`/api/campaign-expenses/${id}`, { method: 'PATCH', body }),
  deleteCampaignExpense: (id) => request(`/api/campaign-expenses/${id}`, { method: 'DELETE' }),
  // billing / revenue (Phase 2 A — admin/operations)
  getBillingModel: (clientId) => request(`/api/clients/${clientId}/billing-model`),
  putBillingModel: (clientId, body) => request(`/api/clients/${clientId}/billing-model`, { method: 'PUT', body }),
  deleteBillingModelVersion: (clientId, versionId) => request(`/api/clients/${clientId}/billing-model/versions/${versionId}`, { method: 'DELETE' }),
  listBillingRuns: (clientId) => request(`/api/clients/${clientId}/billing-runs`),
  recordBillingRun: (clientId, as_of_date) => request(`/api/clients/${clientId}/billing-runs`, { method: 'POST', body: { as_of_date } }),
  deleteBillingRun: (clientId, runId) => request(`/api/clients/${clientId}/billing-runs/${runId}`, { method: 'DELETE' }),
  getRevenue: (clientId, as_of) => request(`/api/revenue?client_id=${clientId}${as_of ? `&as_of=${as_of}` : ''}`),
  // team payouts (Phase 2 B — admin/operations)
  getPayoutModel: (clientId) => request(`/api/clients/${clientId}/payout-model`),
  putPayoutModel: (clientId, body) => request(`/api/clients/${clientId}/payout-model`, { method: 'PUT', body }),
  listPendingPayouts: (clientId) =>
    request(`/api/team-payouts/pending${clientId ? `?client_id=${clientId}` : ''}`),
  listTeamPayouts: ({ client_id, status } = {}) => {
    const qs = new URLSearchParams(
      Object.entries({ client_id, status }).filter(([, v]) => v !== null && v !== undefined && v !== '')
    ).toString();
    return request(`/api/team-payouts${qs ? `?${qs}` : ''}`);
  },
  approvePayout: (appointment_id) => request('/api/team-payouts', { method: 'POST', body: { appointment_id } }),
  markPayoutPaid: (id) => request(`/api/team-payouts/${id}/paid`, { method: 'PATCH' }),
  unpayPayout: (id) => request(`/api/team-payouts/${id}/unpay`, { method: 'PATCH' }),
  revokePayout: (id) => request(`/api/team-payouts/${id}`, { method: 'DELETE' }),
  // P&L dashboard (Phase 2 G — admin only)
  getPnl: ({ from, to, granularity = 'day', client_id } = {}) => {
    const p = new URLSearchParams({ from, to, granularity });
    if (client_id) p.set('client_id', client_id);
    return request(`/api/pnl?${p.toString()}`);
  },
  // client balance (Phase 2 F — admin only)
  getClientBalance: (clientId, asOf) =>
    request(`/api/clients/${clientId}/balance${asOf ? `?as_of=${asOf}` : ''}`),
  listClientPayments: (clientId) => request(`/api/clients/${clientId}/payments`),
  addClientPayment: (clientId, body) => request(`/api/clients/${clientId}/payments`, { method: 'POST', body }),
  deleteClientPayment: (clientId, paymentId) =>
    request(`/api/clients/${clientId}/payments/${paymentId}`, { method: 'DELETE' }),
  listClientPurchases: (clientId) => request(`/api/clients/${clientId}/appointment-purchases`),
  addClientPurchase: (clientId, body) => request(`/api/clients/${clientId}/appointment-purchases`, { method: 'POST', body }),
  deleteClientPurchase: (clientId, purchaseId) =>
    request(`/api/clients/${clientId}/appointment-purchases/${purchaseId}`, { method: 'DELETE' }),
  // unavailability blocks
  listUnavailability: ({ client_id, from, to }) => {
    const qs = new URLSearchParams(
      Object.entries({ client_id, from, to })
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
    ).toString();
    return request(`/api/unavailability?${qs}`);
  },
  createUnavailability: (body) =>
    request('/api/unavailability', { method: 'POST', body }),
  importICSBatch: (body) =>
    request('/api/unavailability/import-ics', { method: 'POST', body }),
  updateUnavailability: (id, body) =>
    request(`/api/unavailability/${id}`, { method: 'PUT', body }),
  deleteUnavailability: (id) =>
    request(`/api/unavailability/${id}`, { method: 'DELETE' }),
};
const API_BASE = "https://lead-ops-api-h67zx.ondigitalocean.app";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("leadops_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail || body.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return res.json();
}

export async function login(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
/**
 * =====================================================
 * SERVICE API — Village Connecté Admin Dashboard
 * Remplace les données mockées par de vraies requêtes
 * =====================================================
 *
 * INSTALLATION dans village-connecte-admin:
 *   Copier ce fichier dans src/services/api.js
 *   Puis dans package.json ajouter:
 *   "proxy": "http://localhost:3001"
 *   ou définir REACT_APP_API_URL=http://localhost:3001
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ── Helpers ───────────────────────────────────────────

function getToken() {
  return localStorage.getItem('vc_token');
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error || data.message || `Erreur HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function get(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { headers: authHeaders() });
  return handleResponse(res);
}

async function post(path, body = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });
  return handleResponse(res);
}

async function put(path, body = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'PUT',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });
  return handleResponse(res);
}

async function patch(path, body = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'PATCH',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });
  return handleResponse(res);
}

async function del(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── AUTH ──────────────────────────────────────────────

export const authAPI = {
  login: (email, password) => post('/api/auth/login', { email, password }),
  me:    ()                => get('/api/auth/me'),
  logout: ()               => post('/api/auth/logout'),
  changePassword: (current, next) =>
    put('/api/auth/password', { current_password: current, new_password: next }),
};

// ── DASHBOARD ─────────────────────────────────────────

export const dashboardAPI = {
  kpis:       ()       => get('/api/dashboard/kpis'),
  revenus:    (days)   => get('/api/dashboard/revenus', { days }),
  connexions: ()       => get('/api/dashboard/connexions'),
};

// ── BORNES ────────────────────────────────────────────

export const bornesAPI = {
  list:       ()         => get('/api/bornes'),
  get:        (id)       => get(`/api/bornes/${id}`),
  create:     (data)     => post('/api/bornes', data),
  update:     (id, data) => put(`/api/bornes/${id}`, data),
  updateStatus: (id, data) => patch(`/api/bornes/${id}/status`, data),
  delete:     (id)       => del(`/api/bornes/${id}`),
};

// ── AGENTS ────────────────────────────────────────────

export const agentsAPI = {
  list:   ()         => get('/api/agents'),
  get:    (id)       => get(`/api/agents/${id}`),
  create: (data)     => post('/api/agents', data),
  update: (id, data) => put(`/api/agents/${id}`, data),
  delete: (id)       => del(`/api/agents/${id}`),
};

// ── VOUCHERS ──────────────────────────────────────────

export const vouchersAPI = {
  list:     (params)   => get('/api/vouchers', params),
  generate: (data)     => post('/api/vouchers/generate', data),
  validate: (code, mac, borneId, ip) =>
    post('/api/vouchers/validate', { code, mac, borne_id: borneId, ip_address: ip }),
  status:   (code)     => get(`/api/vouchers/status/${code}`),
  revoke:   (id)       => del(`/api/vouchers/${id}`),
  stats:    ()         => get('/api/vouchers/stats/summary'),
};

// ── SESSIONS ──────────────────────────────────────────

export const sessionsAPI = {
  list:        ()         => get('/api/sessions'),
  disconnect:  (id)       => del(`/api/sessions/${id}`),
  heartbeat:   (mac, borneId) => post('/api/sessions/heartbeat', { mac, borne_id: borneId }),
};

// ── TRANSACTIONS ──────────────────────────────────────

export const transactionsAPI = {
  list:      (params) => get('/api/transactions', params),
  analytics: ()       => get('/api/transactions/analytics'),
};

// ── ALERTES ───────────────────────────────────────────

export const alertesAPI = {
  list:    (resolue) => get('/api/alertes', resolue !== undefined ? { resolue } : {}),
  resolve: (id)      => patch(`/api/alertes/${id}/resolve`),
  create:  (data)    => post('/api/alertes', data),
};

// ── TARIFS ────────────────────────────────────────────

export const tarifsAPI = {
  list:   ()         => get('/api/tarifs'),
  update: (id, data) => put(`/api/tarifs/${id}`, data),
};

// ── HEALTH ────────────────────────────────────────────

export const healthAPI = {
  check: () => fetch(`${BASE_URL}/health`).then(r => r.json()),
};

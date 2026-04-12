const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// These paths authenticate the user; a 401 here is a credential failure, not
// an expired session, so we must not fire the auto-logout event for them.
const AUTH_PATHS = ['/api/auth/login', '/api/auth/register'];

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  // Don't set Content-Type for FormData — browser sets it with the multipart boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;

    // When any protected endpoint returns 401 it means the token has expired
    // or been revoked.  Fire a global event so AuthContext can auto-logout the
    // user and redirect to the login page with a friendly "session expired"
    // message.  We deliberately skip this for the login / register paths
    // because a 401 there is an intentional "wrong credentials" response.
    if (res.status === 401 && !AUTH_PATHS.includes(path) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const register = (email, password) =>
  request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });

export const getMe = () => request('/api/auth/me');

// ── Items ─────────────────────────────────────────────────────────────────────
export function getItems(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  const qs = new URLSearchParams(entries).toString();
  return request(`/api/items${qs ? '?' + qs : ''}`);
}

export const getItem = (id) => request(`/api/items/${id}`);

export const createItem = (data) =>
  request('/api/items', { method: 'POST', body: JSON.stringify(data) });

export const updateItem = (id, data) =>
  request(`/api/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteItem = (id) =>
  request(`/api/items/${id}`, { method: 'DELETE' });

export const restoreItem = (id) =>
  request(`/api/items/${id}/restore`, { method: 'PATCH' });

export const uploadImages = (id, formData) =>
  request(`/api/items/${id}/images`, { method: 'POST', body: formData });

export const bulkDelete = (ids) =>
  request('/api/items/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });

export const bulkRestore = (ids) =>
  request('/api/items/bulk-restore', { method: 'POST', body: JSON.stringify({ ids }) });

// ── Admin ─────────────────────────────────────────────────────────────────────
export const getUsers = () => request('/api/admin/users');

export const setUserRole = (id, role) =>
  request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });

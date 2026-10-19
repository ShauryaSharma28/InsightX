const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000/api/v1' : '')).replace(/\/$/, '');
const REFRESH_TOKEN_KEY = 'insightx.refreshToken';

let accessToken = null;
let refreshRequest = null;

function endpoint(path) {
  if (!API_BASE_URL) throw new Error('Account features are not configured for this website yet.');
  return `${API_BASE_URL}${path}`;
}

export function setAuthTokens(tokens) {
  accessToken = tokens?.access ?? null;
  if (tokens?.refresh) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  else if (!tokens?.access) localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAuthTokens() {
  accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function request(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(endpoint(path), { ...options, headers });

  if (response.status === 401 && retry && path !== '/auth/token/refresh/') {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request(path, options, false);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      message = body.detail || Object.values(body).flat().join(' ') || message;
    } catch {
      // Keep the status based message for non-JSON responses.
    }
    throw new Error(message);
  }
  if (response.status === 204 || response.status === 205) return null;
  return response.json();
}

export async function refreshAccessToken() {
  if (refreshRequest) return refreshRequest;
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return false;

  refreshRequest = (async () => {
    try {
      const response = await fetch(endpoint('/auth/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) {
        clearAuthTokens();
        return false;
      }
      setAuthTokens(await response.json());
      return true;
    } catch {
      return false;
    } finally {
      refreshRequest = null;
    }
  })();
  return refreshRequest;
}

async function authenticate(path, credentials) {
  const response = await fetch(endpoint(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || Object.values(body).flat().join(' ') || 'Sign in failed.');
  setAuthTokens(body);
  return body;
}

export const registerAccount = (credentials) => authenticate('/auth/register/', credentials);
export const loginAccount = (credentials) => authenticate('/auth/token/', credentials);
export const getCurrentUser = () => request('/auth/me/');
export const listSavedDatasets = () => request('/datasets/');

export async function logoutAccount() {
  try {
    await refreshAccessToken();
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refresh) await request('/auth/logout/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
  } finally {
    clearAuthTokens();
  }
}

export function uploadSavedDataset(file, name) {
  const body = new FormData();
  body.append('file', file, file.name);
  if (name?.trim()) body.append('name', name.trim());
  return request('/datasets/', { method: 'POST', body });
}

export async function downloadSavedDataset(id, retry = true) {
  const response = await fetch(endpoint(`/datasets/${id}/download/`), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (response.status === 401 && retry && await refreshAccessToken()) return downloadSavedDataset(id, false);
  if (!response.ok) throw new Error('This saved dataset could not be downloaded.');
  return response.blob();
}

export const deleteSavedDataset = (id) => request(`/datasets/${id}/`, { method: 'DELETE' });

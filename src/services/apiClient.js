/**
 * Shared API Client for Study Buddy Roulette MERN backend
 */

const rawBase = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '');
const API_BASE_URL = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;

const TOKEN_KEY = 'study_buddy_jwt_token';
const USER_KEY = 'study_buddy_auth_user';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to update stored auth token', err);
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch (err) {
    console.error('Failed to update stored user', err);
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent('study_buddy_auth_changed', { detail: null }));
  } catch (err) {
    console.error('Failed to clear stored auth state', err);
  }
}

/**
 * Core HTTP Request Wrapper
 */
async function request(endpoint, options = {}) {
  let cleanEndpoint = endpoint;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  } else if (cleanEndpoint === '/api') {
    cleanEndpoint = '/';
  }
  const cleanPath = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${cleanPath}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getStoredToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    const err = new Error(
      'Unable to connect to the server. Please ensure the backend is running.'
    );
    err.isNetworkError = true;
    throw err;
  }

  // Parse JSON response safely
  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      data = text ? { message: text } : null;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`;

    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;

    // Handle token expiration/invalidation
    if (response.status === 401 && token) {
      clearStoredAuth();
    }

    throw error;
  }

  return data;
}

export const apiClient = {
  get: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: 'DELETE' }),
  request,
  getBaseUrl: () => API_BASE_URL,
};

export default apiClient;

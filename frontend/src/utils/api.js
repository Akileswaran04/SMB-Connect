/**
 * Fetch wrapper. Every error is turned into one short sentence a shop owner
 * can act on — never "[object Object]", "Failed to fetch" or a stack of
 * field names. A 401 with a saved login ends the session ("smb:logout").
 */
import { t } from '../i18n';

const API_BASE_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? 'http://127.0.0.1:8000/api/v1' : '/api/v1');

const BY_STATUS = {
  0: 'No internet, or the server is not reachable. Please check your connection and try again.',
  400: 'Please check what you entered and try again.',
  401: 'Please log in again.',
  403: "You don't have permission to do that.",
  404: 'We could not find that. It may have been removed.',
  409: 'This already exists.',
  413: 'That file is too big. Please choose a smaller one.',
  422: 'Some details are missing or wrong. Please check and try again.',
  429: 'Too many tries. Please wait a minute and try again.',
  500: 'Something went wrong on our side. Please try again in a minute.',
};

// Server messages written for developers, not shop owners.
const TECHNICAL = /authorization|token|requires role|with id '|not found or inactive|traceback|exception/i;

const FIELD = (name) => String(name).replace(/_/g, ' ').replace(/\b(id|url)\b/gi, '').trim();

export function friendlyMessage(status, data) {
  const detail = data?.detail ?? data?.message;
  if (Array.isArray(detail)) {
    const field = detail[0]?.loc?.filter((x) => typeof x === 'string' && x !== 'body').pop();
    return field ? t('Please check: {field}', { field: t(FIELD(field)) }) : t(BY_STATUS[422]);
  }
  if (typeof detail === 'string' && detail && status < 500 && !TECHNICAL.test(detail)) return t(detail);
  return t(BY_STATUS[status] || BY_STATUS[status >= 500 ? 500 : 400]);
}

class ApiError extends Error {
  constructor(status, data) {
    super(friendlyMessage(status, data));
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = localStorage.getItem('technova_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  } catch {
    throw new ApiError(0, null);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 401 && token) window.dispatchEvent(new Event('smb:logout'));
    throw new ApiError(response.status, data);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
};

export { API_BASE_URL, ApiError };
export default api;

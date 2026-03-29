import axios from 'axios';

/**
 * Resolves `/api` base URL:
 * - `VITE_API_URL` set → direct backend origin (production or explicit local URL)
 * - Dev, unset → same-origin `/api` (Vite `server.proxy` → backend)
 * - Production, unset → same host as the SPA (deploy API behind same origin if applicable)
 */
function resolveApiBaseUrl() {
  const env = import.meta.env.VITE_API_URL?.trim();
  if (env) return `${env.replace(/\/$/, '')}/api`;
  if (import.meta.env.DEV) return '/api';
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 30000,
});

/**
 * Prefer server `error` JSON body; fall back to Axios/network message.
 */
export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback;
  const data = error.response?.data;
  if (data && typeof data === 'object' && data.error != null) return String(data.error);
  if (typeof error.message === 'string' && error.message) return error.message;
  return fallback;
}

export default api;

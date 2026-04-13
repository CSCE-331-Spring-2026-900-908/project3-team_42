import axios from 'axios';

const origin = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** localStorage key for customer kiosk JWT (set after Google sign-in). */
export const CUSTOMER_SESSION_STORAGE_KEY = 'customer_kiosk_session';

const api = axios.create({
  baseURL: `${String(origin).replace(/\/$/, '')}/api`,
});

api.interceptors.request.use((config) => {
  try {
    // Do not send a stale kiosk Bearer token when exchanging a new Google credential.
    const url = config.url || '';

    if (url.includes('/auth/google')) {
      delete config.headers.Authorization;
      return config;
    }

    const token = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* ignore */
  }

  return config;
});

export default api;

import axios from 'axios';

const origin = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${String(origin).replace(/\/$/, '')}/api`,
});

export default api;

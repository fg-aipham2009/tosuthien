import axios from 'axios';
import { useAuth } from '@/composables/useAuth';

const http = axios.create({
  baseURL: '/api',
  // Large MP3 uploads (up to 1 GiB per file) — match nginx proxy_read_timeout
  timeout: 600_000,
});

http.interceptors.request.use((config) => {
  const { getToken } = useAuth();
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401) {
      const { clearSession } = useAuth();
      clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    const raw = err.response?.data?.message;
    const msg =
      (Array.isArray(raw) ? raw.join(', ') : raw) ??
      err.message ??
      'Lỗi không xác định';
    return Promise.reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
  },
);

export default http;

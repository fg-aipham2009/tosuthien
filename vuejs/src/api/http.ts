import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  // Large MP3 uploads (up to 1 GiB per file) — match nginx proxy_read_timeout
  timeout: 600_000,
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err.response?.data?.message
      ?? (Array.isArray(err.response?.data?.message)
        ? err.response.data.message.join(', ')
        : null)
      ?? err.message
      ?? 'Lỗi không xác định';
    return Promise.reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
  },
);

export default http;

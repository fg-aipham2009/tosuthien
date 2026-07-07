import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 120_000,
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

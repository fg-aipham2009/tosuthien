import axios from 'axios'
import { API_BASE } from '../config'

const http = axios.create({
  baseURL: API_BASE,
  timeout: 120_000,
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data
    const msg =
      (typeof data?.message === 'string' && data.message) ||
      (Array.isArray(data?.message) && data.message.join(', ')) ||
      err.message ||
      'Lỗi không xác định'
    return Promise.reject(new Error(msg))
  },
)

export default http

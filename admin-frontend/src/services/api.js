import axios from 'axios';

// Use environment variable for API URL with fallback
// Remove the '/api' suffix since the backend routes are directly at the root
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nord_admin_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('nord_admin_token');
      localStorage.removeItem('nord_admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
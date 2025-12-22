import axios from 'axios';

const API_BASE = '/api';  // Proxied to http://localhost:8000 via vite.config.js

const api = axios.create({
  baseURL: API_BASE,
});

// Single request interceptor: Attach JWT token if exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Optional debug: console.log('Token attached to:', config.url);
  }
  return config;
});

// Single response interceptor: Handle 401 globally
api.interceptors.response.use(
  (response) => response,  // Success: pass through
  (error) => {
    if (error.response?.status === 401) {
      console.warn('401 Unauthorized - Logging out');
      localStorage.removeItem('token');

      // Prevent redirect loop if already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
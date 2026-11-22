import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.foodzy.in/api',
});

// Automatically inject token into every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
import axios from 'axios';

const DEFAULT_BACKEND_URL = 'https://campus-link-backend-vhxr.onrender.com';

const rawEnvUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
let resolvedApiBase;

if (rawEnvUrl) {
  resolvedApiBase = rawEnvUrl.replace(/\/+$/, '').endsWith('/api')
    ? rawEnvUrl.replace(/\/+$/, '')
    : `${rawEnvUrl.replace(/\/+$/, '')}/api`;
} else if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  resolvedApiBase = `${DEFAULT_BACKEND_URL}/api`;
} else {
  resolvedApiBase = 'http://127.0.0.1:8000/api';
}

const API = axios.create({
  baseURL: resolvedApiBase,
});

// Attach JWT Token to requests if available
API.interceptors.request.use(
  (req) => {
    const token = localStorage.getItem('token');
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await API.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.url;
};

/**
 * Resolves any image URL to ensure it points to the correct backend host.
 * Converts legacy 'http://127.0.0.1:8000/uploads/...' or relative '/uploads/...'
 * into the live production backend domain.
 */
export const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('https://') && !url.includes('127.0.0.1') && !url.includes('localhost')) {
    return url;
  }

  const backendHost = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '').replace(/\/api$/, '')
    : 'http://127.0.0.1:8000';

  if (url.startsWith('http://127.0.0.1:8000') || url.startsWith('http://localhost:8000')) {
    return url.replace(/^http:\/\/(127\.0\.0\.1|localhost):8000/, backendHost);
  }
  if (url.startsWith('/uploads')) {
    return `${backendHost}${url}`;
  }
  return url;
};

/**
 * Lightweight background ping to wake up a sleeping Render instance early.
 * Fired as a fire-and-forget request when the user lands on the website.
 */
export const warmUpBackend = () => {
  if (typeof window === 'undefined') return;
  try {
    const backendRoot = resolvedApiBase.replace(/\/api$/, '');
    fetch(`${backendRoot}/`, { method: 'GET', mode: 'no-cors' }).catch(() => {});
  } catch {}
};

// Automatically fire early wakeup ping upon frontend load
if (typeof window !== 'undefined') {
  setTimeout(warmUpBackend, 50);
}

export default API;


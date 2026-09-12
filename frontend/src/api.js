import axios from 'axios';

const DEFAULT_BACKEND_URL = 'https://campus-link-backend-vhxr.onrender.com';

const rawEnvUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
let resolvedApiBase;

if (rawEnvUrl && !rawEnvUrl.includes('campuslink-backend.onrender.com')) {
  resolvedApiBase = rawEnvUrl.replace(/\/+$/, '').endsWith('/api')
    ? rawEnvUrl.replace(/\/+$/, '')
    : `${rawEnvUrl.replace(/\/+$/, '')}/api`;
} else {
  resolvedApiBase = `${DEFAULT_BACKEND_URL}/api`;
}

const API = axios.create({
  baseURL: resolvedApiBase,
});

export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token') || localStorage.getItem('campuslink_token');
  return (token && token.trim().length > 10) ? token.trim() : null;
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};

// Attach JWT Token to requests if available
API.interceptors.request.use(
  (req) => {
    const token = getAuthToken();
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Axios retry interceptor for Render cold starts (502, 503, 504, Network Error)
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    // If request failed due to cold start or network error, retry up to 3 times
    const isColdStartOrNetwork =
      !error.response ||
      error.response.status === 502 ||
      error.response.status === 503 ||
      error.response.status === 504 ||
      error.code === 'ERR_NETWORK' ||
      error.message?.includes('Network Error');

    config.__retryCount = config.__retryCount || 0;
    const maxRetries = config.method === 'get' ? 3 : 1;

    if (isColdStartOrNetwork && config.__retryCount < maxRetries) {
      config.__retryCount += 1;
      const delayMs = Math.min(1000 * Math.pow(2, config.__retryCount), 6000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return API(config);
    }

    if (error?.response?.status === 401) {
      const token = getAuthToken();
      if (!token && typeof window !== 'undefined') {
        const isAlreadyOnAuth =
          window.location.pathname === '/login' ||
          window.location.pathname === '/signup' ||
          window.location.pathname === '/auth';
        if (!isAlreadyOnAuth) {
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('campuslink_token');
            localStorage.removeItem('user');
          } catch {}
          window.location.href = '/login';
        }
      }
    }
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
 * 
 * Automatically applies Cloudinary mobile-bandwidth optimizations (f_auto, q_auto, w_600)
 * to prevent massive image payloads and speed up render times across mobile 4G/3G connections.
 */
export const getMediaUrl = (url, options = {}) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  let cleanUrl = String(url).trim();

  // Normalize options (support number, string preset, or object)
  let width = 600;
  let quality = 'auto';
  let format = 'auto';
  let crop = 'limit';
  let gravity = '';

  if (typeof options === 'number') {
    width = options;
  } else if (typeof options === 'string') {
    if (options === 'avatar') {
      width = 200;
      crop = 'fill';
      gravity = 'g_face,';
    } else if (options === 'thumb' || options === 'thumbnail') {
      width = 300;
    } else if (options === 'full' || options === 'banner') {
      width = 1200;
    }
  } else if (typeof options === 'object' && options !== null) {
    if (options.width) width = options.width;
    if (options.quality) quality = options.quality;
    if (options.format) format = options.format;
    if (options.crop) crop = options.crop;
    if (options.gravity) gravity = `g_${options.gravity},`;
  }

  // Cloudinary image bandwidth and format optimization
  if (cleanUrl.includes('res.cloudinary.com') && cleanUrl.includes('/image/upload/')) {
    // Only apply if not already containing transform parameters
    if (!cleanUrl.match(/\/image\/upload\/[a-z]_[a-z0-9_,]+\//i)) {
      const transform = `${gravity}f_${format},q_${quality},w_${width},c_${crop}`;
      cleanUrl = cleanUrl.replace('/image/upload/', `/image/upload/${transform}/`);
    }
  } else if (cleanUrl.includes('res.cloudinary.com') && cleanUrl.includes('/upload/') && !cleanUrl.includes('/video/upload/')) {
    if (!cleanUrl.match(/\/upload\/[a-z]_[a-z0-9_,]+\//i)) {
      const transform = `${gravity}f_${format},q_${quality},w_${width},c_${crop}`;
      cleanUrl = cleanUrl.replace('/upload/', `/upload/${transform}/`);
    }
  }

  const rawHost = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  const backendHost = (rawHost && !rawHost.includes('campuslink-backend.onrender.com') ? rawHost : DEFAULT_BACKEND_URL)
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

  // Rewrite any stale/legacy Express domain to the real active backend domain
  if (cleanUrl.includes('campuslink-backend.onrender.com')) {
    cleanUrl = cleanUrl.replace(/https?:\/\/campuslink-backend\.onrender\.com/, backendHost);
  }

  // Rewrite localhost / 127.0.0.1 dev URLs
  if (cleanUrl.startsWith('http://127.0.0.1:8000') || cleanUrl.startsWith('http://localhost:8000')) {
    cleanUrl = cleanUrl.replace(/^http:\/\/(127\.0\.0\.1|localhost):8000/, backendHost);
  }

  // Relative uploads path
  if (cleanUrl.startsWith('/uploads') || cleanUrl.startsWith('uploads/')) {
    return `${backendHost}/${cleanUrl.replace(/^\/+/, '')}`;
  }

  // Relative eateries path
  if (cleanUrl.startsWith('/eateries') || cleanUrl.startsWith('eateries/')) {
    return `${backendHost}/${cleanUrl.replace(/^\/+/, '')}`;
  }

  // Prevent mixed-content blocking on HTTPS (Render production)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && cleanUrl.startsWith('http://') && !cleanUrl.includes('localhost') && !cleanUrl.includes('127.0.0.1')) {
    cleanUrl = cleanUrl.replace('http://', 'https://');
  }

  return cleanUrl;
};

/**
 * Lightweight background ping to wake up a sleeping Render instance early.
 * Fires two parallel requests: root ping (no-cors) + health check.
 */
export const warmUpBackend = () => {
  if (typeof window === 'undefined') return;
  const backendRoot = resolvedApiBase.replace(/\/api$/, '');
  // Fire-and-forget: both pings in parallel for maximum wakeup speed
  try { fetch(`${backendRoot}/`, { method: 'GET', mode: 'no-cors' }).catch(() => {}); } catch {}
  try { fetch(`${backendRoot}/api/health`, { method: 'GET', mode: 'no-cors' }).catch(() => {}); } catch {}
};

/**
 * Re-usable explicit ping for components that need to check/force backend alive.
 */
export const pingBackend = warmUpBackend;

// Fire immediately on module load — wakes the backend while user reads the page
if (typeof window !== 'undefined') {
  warmUpBackend();
  // Keep backend warm every 3 minutes so Render never sleeps while user is active
  setInterval(() => {
    warmUpBackend();
  }, 3 * 60 * 1000);
}

export const getWsUrl = (path = '') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const rawHost = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (rawHost && (rawHost.includes('127.0.0.1:8000') || rawHost.includes('localhost:8000'))) {
    return `ws://127.0.0.1:8000${cleanPath}`;
  }
  
  const root = (rawHost && !rawHost.includes('campuslink-backend.onrender.com') ? rawHost : DEFAULT_BACKEND_URL)
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
  
  const wsRoot = root.startsWith('https://')
    ? root.replace('https://', 'wss://')
    : root.replace('http://', 'ws://');
    
  return `${wsRoot}${cleanPath}`;
};

export default API;


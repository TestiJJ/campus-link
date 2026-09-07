/**
 * prefetch.js — CampusLink Post-Login Background Prefetch
 *
 * Called immediately after a successful login while React Router is
 * animating the page transition. By the time the dashboard component
 * mounts, all critical data is already warm in the queryCache — so the
 * user sees real content instead of skeleton spinners.
 *
 * Usage (Auth.jsx):
 *   import { prefetchAfterLogin } from './prefetch';
 *   // after setting token/user in localStorage:
 *   prefetchAfterLogin(data.user, data.access_token);
 *   navigate('/student-dashboard');
 */

import { setCache, TTL } from './queryCache';
import { primeConversationsCache, clearThreadMemoryCache } from './chatCache';

const DEFAULT_BACKEND = 'https://campus-link-backend-vhxr.onrender.com';

function getApiBase() {
  const raw = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (raw && !raw.includes('campuslink-backend.onrender.com')) {
    const stripped = raw.replace(/\/+$/, '');
    return stripped.endsWith('/api') ? stripped : `${stripped}/api`;
  }
  return `${DEFAULT_BACKEND}/api`;
}

async function authGet(path, token) {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    // Signal timeout after 8 s — this is background work, never blocks UI
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`prefetch ${path}: ${res.status}`);
  return res.json();
}

/**
 * Kick off all critical dashboard data fetches in parallel.
 * Errors are swallowed — this is strictly a UX optimisation.
 * If any request fails, the dashboard will fetch it normally on mount.
 *
 * @param {object} user  - User object returned from /api/login
 * @param {string} token - JWT access token
 */
export async function prefetchAfterLogin(user, token) {
  if (!user || !token) return;

  const role = user.role;

  // Requests to prefetch in parallel, scoped by role
  const tasks = [];

  // 1. Profile — always needed
  tasks.push(
    authGet('/me', token)
      .then(data => setCache('profile', data, TTL.PROFILE))
      .catch(() => {})
  );

  // 2. Notifications — students and vendors
  if (role === 'student' || role === 'vendor') {
    tasks.push(
      authGet('/notifications', token)
        .then(data => setCache('notifications', data, TTL.NOTIFICATIONS))
        .catch(() => {})
    );
  }

  // 3. Conversations — students and vendors
  if (role === 'student' || role === 'vendor') {
    tasks.push(
      authGet('/conversations', token)
        .then(data => {
          setCache('conversations', data, TTL.CONVERSATIONS);
          // Prime chatCache previews with fresh server data so the conversation list
          // shows the correct last message + unread counts before loadAllData() finishes.
          // Also evict the in-memory message thread cache so the next thread open
          // always fetches fresh messages from the server (not pre-exit stale data).
          if (Array.isArray(data)) {
            primeConversationsCache(data);
            clearThreadMemoryCache();
          }
        })
        .catch(() => {})
    );
  }

  // Fire all in parallel, don't await — the navigate() call is non-blocking
  Promise.all(tasks).catch(() => {});
}

/**
 * queryCache.js — CampusLink Global SWR Data Cache
 *
 * Lightweight stale-while-revalidate cache that eliminates blank spinners
 * when navigating between tabs. Works with any async API call.
 *
 * Architecture:
 *  • Primary store  : module-level Map — survives re-renders, 0ms reads
 *  • Secondary store: sessionStorage mirror — survives tab switches
 *  • TTL model      : stale data is returned instantly while background
 *    revalidation fires silently, then onUpdate() triggers a re-render
 */

const memoryStore = new Map();

const SS_PREFIX = 'cl_qc_';

// Default TTLs per data category
export const TTL = {
  PROFILE:       5 * 60 * 1000,  // 5 min — changes rarely
  NOTIFICATIONS: 60 * 1000,      // 1 min — moderate churn
  CONVERSATIONS: 30 * 1000,      // 30 s  — active chat
  MARKETPLACE:   3 * 60 * 1000,  // 3 min — slow-changing listings
  GENERIC:       2 * 60 * 1000,  // 2 min — fallback
};

// ─── Write ────────────────────────────────────────────────────────────────────

export const setCache = (key, data, ttlMs = TTL.GENERIC) => {
  const entry = { data, cachedAt: Date.now(), ttlMs };
  memoryStore.set(key, entry);
  try {
    sessionStorage.setItem(`${SS_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // sessionStorage quota exceeded — memory-only is fine
  }
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export const getCache = (key) => {
  let entry = memoryStore.get(key);

  if (!entry) {
    try {
      const raw = sessionStorage.getItem(`${SS_PREFIX}${key}`);
      if (raw) {
        entry = JSON.parse(raw);
        if (entry) memoryStore.set(key, entry);
      }
    } catch { /* corrupted entry — ignore */ }
  }

  if (!entry) return { hit: false, fresh: false, data: null };

  const age = Date.now() - entry.cachedAt;
  const fresh = age < entry.ttlMs;
  return { hit: true, fresh, data: entry.data };
};

// ─── Invalidate ───────────────────────────────────────────────────────────────

export const invalidateCache = (key) => {
  memoryStore.delete(key);
  try { sessionStorage.removeItem(`${SS_PREFIX}${key}`); } catch {}
};

export const invalidateCachePrefix = (prefix) => {
  for (const k of memoryStore.keys()) {
    if (k.startsWith(prefix)) memoryStore.delete(k);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(`${SS_PREFIX}${prefix}`)) sessionStorage.removeItem(k);
    }
  } catch {}
};

export const clearAllCache = () => {
  memoryStore.clear();
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SS_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch {}
};

// ─── SWR Helper ───────────────────────────────────────────────────────────────

/**
 * Stale-While-Revalidate fetch wrapper.
 *
 * Returns cached data immediately (0ms). Fires a background refetch if the
 * entry is stale or missing, then calls onUpdate(freshData) to trigger a
 * re-render with fresh results.
 *
 * @param {object} opts
 * @param {string}   opts.key
 * @param {Function} opts.fetcher  - Async fn that returns fresh data
 * @param {number}   opts.ttlMs
 * @param {Function} opts.onUpdate - Called with fresh data after bg revalidation
 * @returns {*} Immediately available data (null on first-ever load)
 */
export const swrFetch = ({ key, fetcher, ttlMs = TTL.GENERIC, onUpdate }) => {
  const cached = getCache(key);

  if (!cached.fresh) {
    (async () => {
      try {
        const freshData = await fetcher();
        setCache(key, freshData, ttlMs);
        if (typeof onUpdate === 'function') onUpdate(freshData);
      } catch (err) {
        console.warn(`[queryCache] SWR revalidation failed for "${key}":`, err);
      }
    })();
  }

  return cached.data;
};

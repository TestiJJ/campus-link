/**
 * optimisticUpdate.js — CampusLink Optimistic UI Pattern
 *
 * Provides 0ms perceived latency for user actions by immediately updating
 * local state, firing the API call in the background, and rolling back
 * smoothly if the server returns an error.
 *
 * Usage example (mark notification as read):
 *
 *   import { optimisticUpdate } from './optimisticUpdate';
 *
 *   const handleMarkRead = (notifId) => {
 *     optimisticUpdate({
 *       applyFn: () => setNotifications(prev =>
 *         prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
 *       ),
 *       apiFn: () => API.post(`/notifications/${notifId}/read`),
 *       rollbackFn: () => setNotifications(prev =>
 *         prev.map(n => n.id === notifId ? { ...n, is_read: false } : n)
 *       ),
 *       onError: (err) => console.warn('Failed to mark read:', err),
 *     });
 *   };
 */

/**
 * @param {object}   opts
 * @param {Function} opts.applyFn    - Synchronous fn to immediately update local state
 * @param {Function} opts.apiFn      - Async fn that executes the network call
 * @param {Function} [opts.rollbackFn] - Synchronous fn called if the API fails
 * @param {Function} [opts.onError]  - Called with the error if API fails (for toasts etc.)
 * @param {Function} [opts.onSuccess] - Called with the API response on success
 * @returns {Promise<void>}
 */
export async function optimisticUpdate({
  applyFn,
  apiFn,
  rollbackFn,
  onError,
  onSuccess,
}) {
  // 1. Apply immediately — user sees the change at 0ms
  try {
    applyFn();
  } catch (e) {
    console.warn('[optimisticUpdate] applyFn threw:', e);
  }

  // 2. Execute the network call in the background
  try {
    const result = await apiFn();
    if (typeof onSuccess === 'function') onSuccess(result);
  } catch (err) {
    // 3. Rollback on failure
    if (typeof rollbackFn === 'function') {
      try {
        rollbackFn();
      } catch (re) {
        console.warn('[optimisticUpdate] rollbackFn threw:', re);
      }
    }
    if (typeof onError === 'function') {
      onError(err);
    } else {
      console.warn('[optimisticUpdate] API call failed (no onError handler):', err);
    }
  }
}

/**
 * Batch variant — apply one optimistic update for multiple items.
 * e.g. mark-all-notifications-read.
 *
 * @param {object}   opts
 * @param {Function} opts.applyFn
 * @param {Function} opts.apiFn
 * @param {Function} [opts.rollbackFn]
 * @param {Function} [opts.onError]
 */
export async function optimisticBatch({
  applyFn,
  apiFn,
  rollbackFn,
  onError,
}) {
  return optimisticUpdate({ applyFn, apiFn, rollbackFn, onError });
}

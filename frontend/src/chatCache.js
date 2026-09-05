/**
 * WhatsApp-Grade Instant Chat Conversation Cache & Stale-While-Revalidate Manager
 * Provides 0ms instant thread switching, in-memory Map + localStorage persistence,
 * smart message deduplication, and non-blocking background revalidation.
 */

// Global in-memory thread storage (persists across tab navigation and re-renders)
const messageThreadsCache = new Map();
const threadMetaCache = new Map();
const activeFetches = new Map();

// Helper to normalize partner ID to string
const toKey = (partnerId) => String(partnerId || '').trim();

/**
 * Deduplicate and sort messages by creation time / ID
 */
export const normalizeAndSortMessages = (msgs) => {
  if (!Array.isArray(msgs)) return [];
  const seen = new Set();
  const result = [];

  for (const m of msgs) {
    if (!m) continue;
    // Build unique identifier key (prefer database id, fallback to client_id or timestamp/content hash)
    const uniqueKey = m.id ? `id_${m.id}` : m.client_id ? `cid_${m.client_id}` : `tmp_${m.sender_id}_${m.created_at}_${m.content}`;
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      result.push(m);
    }
  }

  // Sort ascending by created_at or id
  result.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.id || 0) - (b.id || 0);
  });

  return result;
};

/**
 * Get cached messages synchronously in 0ms (Memory first, fallback to localStorage)
 */
export const getCachedThreadMessages = (partnerId) => {
  const key = toKey(partnerId);
  if (!key) return [];

  // 1. Fast path: Memory cache (0.00ms)
  if (messageThreadsCache.has(key)) {
    return messageThreadsCache.get(key) || [];
  }

  // 2. Persistent path: localStorage
  try {
    const raw = localStorage.getItem(`cl_msg_thread_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sorted = normalizeAndSortMessages(parsed);
        messageThreadsCache.set(key, sorted);
        return sorted;
      }
    }
  } catch (err) {
    console.warn('[chatCache] localStorage read error:', err);
  }

  return [];
};

/**
 * Save messages to in-memory cache and mirror recent 150 items to localStorage
 */
export const setCachedThreadMessages = (partnerId, messages) => {
  const key = toKey(partnerId);
  if (!key || !Array.isArray(messages)) return;

  const normalized = normalizeAndSortMessages(messages);
  messageThreadsCache.set(key, normalized);
  threadMetaCache.set(key, { lastUpdated: Date.now() });

  try {
    // Keep last 150 messages in localStorage for lightning fast startup
    const toPersist = normalized.slice(-150);
    localStorage.setItem(`cl_msg_thread_${key}`, JSON.stringify(toPersist));
  } catch (err) {
    // If storage quota exceeded, clear older cached threads
    try {
      cleanupOldLocalStorageThreads();
    } catch {}
  }
};

/**
 * Merge new server or WebSocket messages into an existing thread
 */
export const mergeThreadMessages = (partnerId, incomingMessages) => {
  const key = toKey(partnerId);
  if (!key) return [];
  const current = getCachedThreadMessages(key);
  const incoming = Array.isArray(incomingMessages) ? incomingMessages : [incomingMessages].filter(Boolean);

  const merged = normalizeAndSortMessages([...current, ...incoming]);
  setCachedThreadMessages(key, merged);
  return merged;
};

/**
 * Append a single message (e.g. optimistic send or incoming WebSocket push)
 */
export const appendThreadMessage = (partnerId, message) => {
  if (!message) return;
  return mergeThreadMessages(partnerId, [message]);
};

/**
 * Update message status (e.g. optimistic message confirmed with real ID from server)
 */
export const updateThreadMessage = (partnerId, tempId, updatedMsg) => {
  const key = toKey(partnerId);
  if (!key) return [];
  const current = getCachedThreadMessages(key);
  const updated = current.map(m => {
    if (m.id === tempId || m.client_id === tempId || (m.id && String(m.id).startsWith('temp-') && m.content === updatedMsg.content)) {
      return { ...m, ...updatedMsg };
    }
    return m;
  });
  setCachedThreadMessages(key, updated);
  return updated;
};

/**
 * Prime entire conversations cache synchronously from /api/conversations payload
 */
export const primeConversationsCache = (conversationsList) => {
  if (!Array.isArray(conversationsList) || conversationsList.length === 0) return;

  for (const c of conversationsList) {
    const pid = c.partner_id || c.user_id || c.id;
    if (!pid) continue;

    // If conversation object bundles recent_messages, cache them immediately
    if (Array.isArray(c.recent_messages) && c.recent_messages.length > 0) {
      mergeThreadMessages(pid, c.recent_messages);
    } else if (c.last_message) {
      // If only last_message is present and thread is empty, seed a preview message
      const existing = getCachedThreadMessages(pid);
      if (existing.length === 0) {
        const previewMsg = {
          id: `preview_${pid}_${c.last_timestamp || Date.now()}`,
          sender_id: c.partner_id,
          recipient_id: 'me',
          content: c.last_message,
          message_type: 'text',
          created_at: c.last_timestamp || new Date().toISOString(),
          is_preview: true
        };
        setCachedThreadMessages(pid, [previewMsg]);
      }
    }
  }
};

/**
 * Background Stale-While-Revalidate thread fetcher
 * Fetches latest messages from API without blocking UI and merges updates silently.
 */
export const revalidateThreadMessages = async (partnerId, API, onMessagesUpdated = null) => {
  const key = toKey(partnerId);
  if (!key || !API) return getCachedThreadMessages(key);

  // Prevent duplicate concurrent in-flight requests for the same partner
  if (activeFetches.has(key)) {
    return activeFetches.get(key);
  }

  const fetchPromise = (async () => {
    try {
      const res = await API.get(`/messages/${key}`);
      const serverMsgs = Array.isArray(res.data) ? res.data : (res.data?.messages || []);
      const current = getCachedThreadMessages(key);

      // Check if anything actually changed to avoid unnecessary re-renders
      const isIdentical =
        current.length === serverMsgs.length &&
        current.length > 0 &&
        current[current.length - 1]?.id === serverMsgs[serverMsgs.length - 1]?.id;

      if (!isIdentical || current.some(m => m.is_preview)) {
        const merged = normalizeAndSortMessages(serverMsgs);
        setCachedThreadMessages(key, merged);
        if (typeof onMessagesUpdated === 'function') {
          onMessagesUpdated(merged);
        }
        return merged;
      }
      return current;
    } catch (err) {
      console.warn('[chatCache] background revalidate error for', key, err);
      return getCachedThreadMessages(key);
    } finally {
      activeFetches.delete(key);
    }
  })();

  activeFetches.set(key, fetchPromise);
  return fetchPromise;
};

/**
 * Smart bottom auto-scroll that preserves smooth UX without layout thrashing
 */
export const smartScrollToBottom = (container, smooth = false) => {
  if (!container) return;
  requestAnimationFrame(() => {
    try {
      if (smooth) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    } catch {
      container.scrollTop = container.scrollHeight;
    }
  });
};

/**
 * Check if the user is near the bottom of the conversation
 */
export const isUserNearBottom = (container, threshold = 150) => {
  if (!container) return true;
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance <= threshold;
};

/**
 * Storage cleanup helper
 */
const cleanupOldLocalStorageThreads = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cl_msg_thread_')) {
        keysToRemove.push(k);
      }
    }
    // Remove half of oldest threads
    keysToRemove.slice(0, Math.floor(keysToRemove.length / 2)).forEach(k => localStorage.removeItem(k));
  } catch {}
};

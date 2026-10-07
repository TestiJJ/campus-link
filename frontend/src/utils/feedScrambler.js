import { useState, useEffect, useMemo } from 'react';

/**
 * Creates a deterministic pseudorandom number generator (Mulberry32)
 * seeded by a numerical seed.
 */
function createMulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Helper to determine the age of an item in minutes.
 */
function getItemAgeMinutes(item) {
  if (!item) return Infinity;
  if (item.is_optimistic || item._is_new) return 0;
  const rawDate = item.created_at || item.createdAt || item.date || item.timestamp;
  if (!rawDate) return Infinity;
  const parsed = new Date(rawDate).getTime();
  if (isNaN(parsed)) return Infinity;
  const ageMs = Date.now() - parsed;
  return ageMs > 0 ? ageMs / (60 * 1000) : 0;
}

/**
 * Scatters and randomly rotates feed items over time.
 *
 * FRESH POST PRIORITY RULE:
 * - If someone posts a new picture or post, it MUST come first in the feed!
 * - It stays at the top of the feed for a grace period (e.g. 20-30 minutes) before
 *   blending into the periodic rotating scattered pool.
 * - Posts by the current user stay prioritized even longer (45 minutes) so the
 *   author immediately sees their post at the front of their feed.
 * - All other (older) items are pseudo-randomly shuffled and author-interleaved
 *   every `timeWindowMinutes` (default: 3 minutes) so the feed stays lively and fair.
 *
 * @param {Array} items - Array of feed items (reels, products, services)
 * @param {Object} options - Configuration options
 * @returns {Array} Array with fresh posts first, followed by rotating scattered items
 */
export function scatterFeed(items = [], options = {}) {
  if (!items || !Array.isArray(items) || items.length <= 1) {
    return items || [];
  }

  const {
    timeWindowMinutes = 3,
    freshWindowMinutes = 20,
    myPostGraceMinutes = 45,
    currentUserId = null,
    authorKey = (item) => (
      item.vendor_id ||
      item.vendor_user_id ||
      item.user_id ||
      item.author_id ||
      item.creator_id ||
      item.vendor_name ||
      item.author_name ||
      item.id
    )
  } = options;

  // 1. Separate fresh posts from older posts
  const freshItems = [];
  const olderItems = [];

  for (const item of items) {
    const ageMins = getItemAgeMinutes(item);
    const itemAuthor = String(item.user_id || item.author_id || item.creator_id || item.vendor_id || item.vendor_user_id || '');
    const isMyPost = currentUserId && itemAuthor === String(currentUserId);

    // If it is the current user's post within grace period, or any post within fresh window:
    const isFresh = (isMyPost && ageMins <= myPostGraceMinutes) || (ageMins <= freshWindowMinutes);

    if (isFresh) {
      freshItems.push(item);
    } else {
      olderItems.push(item);
    }
  }

  // Fresh items stay strictly ordered newest-first so the newest post is at the very top
  freshItems.sort((a, b) => {
    const timeA = new Date(a.created_at || a.createdAt || a.date || a.timestamp || 0).getTime() || 0;
    const timeB = new Date(b.created_at || b.createdAt || b.date || b.timestamp || 0).getTime() || 0;
    return timeB - timeA;
  });

  if (olderItems.length <= 1) {
    return [...freshItems, ...olderItems];
  }

  // 2. Scatter and rotate older items across authors
  // Windowed time seed (changes every `timeWindowMinutes` minutes or with seedOffset)
  const timeSlot = Math.floor(Date.now() / (timeWindowMinutes * 60 * 1000)) + (options.seedOffset || 0);
  const rng = createMulberry32(timeSlot);

  // Group older items by creator / vendor
  const buckets = new Map();
  const cloned = [...olderItems];

  // Initial pseudo-shuffle within list
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }

  // Put into author buckets
  for (const item of cloned) {
    const key = String(authorKey(item) || 'unknown');
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(item);
  }

  const bucketArrays = Array.from(buckets.values());

  // Shuffle the order of the buckets
  for (let i = bucketArrays.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bucketArrays[i], bucketArrays[j]] = [bucketArrays[j], bucketArrays[i]];
  }

  // Round-robin interleave across buckets
  const scatteredOlder = [];
  let hasMore = true;
  let round = 0;

  while (hasMore) {
    hasMore = false;
    const offset = Math.floor(rng() * bucketArrays.length);

    for (let k = 0; k < bucketArrays.length; k++) {
      const idx = (k + offset) % bucketArrays.length;
      const bucket = bucketArrays[idx];
      if (bucket && bucket.length > round) {
        scatteredOlder.push(bucket[round]);
        if (bucket.length > round + 1) {
          hasMore = true;
        }
      }
    }
    round++;
  }

  const finalOlder = scatteredOlder.length === olderItems.length ? scatteredOlder : cloned;

  // Fresh posts come first, then rotating scattered older posts
  return [...freshItems, ...finalOlder];
}

/**
 * Custom React hook that produces a scattered and periodically auto-rotating feed.
 * Keeps fresh posts pinned to top for their initial grace period before rotating.
 */
export function useRotatingFeed(items = [], options = {}) {
  const timeWindow = options.timeWindowMinutes || 3;
  const [rotationTick, setRotationTick] = useState(0);

  useEffect(() => {
    const intervalMs = Math.max(timeWindow * 60 * 1000, 30000);
    const timer = setInterval(() => {
      setRotationTick(t => t + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [timeWindow]);

  return useMemo(() => {
    return scatterFeed(items, { ...options, timeWindowMinutes: timeWindow });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, rotationTick, timeWindow, options.seedOffset, options.currentUserId]);
}

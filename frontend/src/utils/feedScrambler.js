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
 * Scatters and randomly rotates feed items over time.
 * - Shuffles items pseudo-randomly using a time-windowed seed (e.g. rotates every 3 minutes)
 *   so the feed changes randomly from time to time.
 * - Clusters by author/vendor and round-robin interleaves them to avoid the same seller/user
 *   dominating consecutive slots (true "scattered" distribution).
 *
 * @param {Array} items - Array of feed items (reels, products, services)
 * @param {Object} options - Configuration options
 * @returns {Array} Scattered and pseudo-randomly rotated array
 */
export function scatterFeed(items = [], options = {}) {
  if (!items || !Array.isArray(items) || items.length <= 2) {
    return items || [];
  }

  const {
    timeWindowMinutes = 3,
    authorKey = (item) => (
      item.vendor_id ||
      item.vendor_user_id ||
      item.user_id ||
      item.author_id ||
      item.vendor_name ||
      item.author_name ||
      item.id
    )
  } = options;

  // Windowed time seed (changes every `timeWindowMinutes` minutes)
  const timeSlot = Math.floor(Date.now() / (timeWindowMinutes * 60 * 1000));
  const rng = createMulberry32(timeSlot);

  // Group items by creator / vendor
  const buckets = new Map();
  const cloned = [...items];

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
  const result = [];
  let hasMore = true;
  let round = 0;

  while (hasMore) {
    hasMore = false;
    // Vary the starting bucket per round to enhance scatter
    const offset = Math.floor(rng() * bucketArrays.length);

    for (let k = 0; k < bucketArrays.length; k++) {
      const idx = (k + offset) % bucketArrays.length;
      const bucket = bucketArrays[idx];
      if (bucket && bucket.length > round) {
        result.push(bucket[round]);
        if (bucket.length > round + 1) {
          hasMore = true;
        }
      }
    }
    round++;
  }

  return result.length === items.length ? result : cloned;
}

/**
 * Custom React hook that produces a scattered and periodically auto-rotating feed.
 * Updates smoothly every `timeWindowMinutes` or whenever the underlying items change.
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
  }, [items, rotationTick, timeWindow]);
}


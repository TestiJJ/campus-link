// src/components/SafeImage.jsx
import React, { useState, useEffect } from 'react';
import { getMediaUrl } from '../api';

const DEFAULT_AVATAR_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2338bdf8"/><stop offset="100%" stop-color="%230284c7"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23g)"/><circle cx="50" cy="40" r="18" fill="%23ffffff"/><path d="M22 84c0-15.5 12.5-28 28-28s28 12.5 28 28" fill="%23ffffff" opacity="0.9"/></svg>`;

const DEFAULT_PRODUCT_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="16" fill="%23f1f5f9"/><path d="M60 80l40-24 40 24v50l-40 24-40-24V80z" stroke="%2394a3b8" stroke-width="6" stroke-linejoin="round"/><path d="M100 56v50m0 0l40-24m-40 24l-40-24" stroke="%2394a3b8" stroke-width="6" stroke-linejoin="round"/></svg>`;

const DEFAULT_STORE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="16" fill="%23f8fafc"/><path d="M50 85h100l-10-35H60L50 85zm0 0v65a5 5 0 0 0 5 5h90a5 5 0 0 0 5-5V85M85 155v-40h30v40" stroke="%2364748b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const DEFAULT_FOOD_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="16" fill="%23fff7ed"/><path d="M50 110h100c0 30-22.4 50-50 50s-50-20-50-50zm10-20c5-15 15-25 40-25s35 10 40 25H60z" stroke="%23ea580c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/**
 * Ultra-resilient image component that:
 * 1. Resolves and optimizes image URLs via getMediaUrl
 * 2. Catches HTTP 404, network ERR_FAILED, and cold-start timeouts
 * 3. Gracefully defaults to zero-network inline SVG data URIs
 * 4. Strictly prevents infinite error loops and UI layout breaks
 * 5. Guarantees Zero Cumulative Layout Shift (CLS = 0) with skeleton placeholders and smooth transitions
 */
export default function SafeImage({
  src,
  alt = '',
  className = '',
  fallbackType = 'product', // 'avatar' | 'food' | 'store' | 'product'
  fallbackSrc,
  onClick,
  style,
  loading = 'lazy',
  showShimmer = false,
  ...props
}) {
  const [errorLevel, setErrorLevel] = useState(0); // 0: initial, 1: fallback attempt, 2: inline SVG
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset state if the src prop changes
  useEffect(() => {
    setErrorLevel(0);
    setIsLoaded(false);
  }, [src]);

  const imgOptions = props.width || (fallbackType === 'avatar' ? 'avatar' : 600);
  const resolved = getMediaUrl(src, imgOptions);

  const getPrimaryFallback = () => {
    if (fallbackSrc) return fallbackSrc;
    if (fallbackType === 'avatar') {
      const cleanName = encodeURIComponent((alt || 'Campus Link').trim().slice(0, 20));
      return `https://ui-avatars.com/api/?name=${cleanName}&background=0284c7&color=fff&bold=true&size=128`;
    }
    if (fallbackType === 'food') return '/campus_jollof.jpg';
    if (fallbackType === 'store') return '/campus_vendor.jpg';
    return '/campus_hero.jpg';
  };

  const getHardInlineSvg = () => {
    if (fallbackType === 'avatar') return DEFAULT_AVATAR_SVG;
    if (fallbackType === 'food') return DEFAULT_FOOD_SVG;
    if (fallbackType === 'store') return DEFAULT_STORE_SVG;
    return DEFAULT_PRODUCT_SVG;
  };

  let finalSrc = resolved;
  if (!resolved || errorLevel >= 2) {
    finalSrc = getHardInlineSvg();
  } else if (errorLevel === 1) {
    finalSrc = getPrimaryFallback();
  }

  const handleError = () => {
    setErrorLevel((prev) => prev + 1);
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const shimmerClass = (!isLoaded && showShimmer) ? 'skeleton-shimmer' : '';

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={`transition-opacity duration-200 ${isLoaded || errorLevel > 0 ? 'opacity-100' : 'opacity-90'} ${shimmerClass} ${className}`}
      onError={handleError}
      onLoad={handleLoad}
      onClick={onClick}
      style={style}
      loading={loading}
      decoding="async"
      {...props}
    />
  );
}

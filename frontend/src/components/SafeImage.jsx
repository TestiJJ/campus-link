// src/components/SafeImage.jsx
import React, { useState, useEffect } from 'react';
import { getMediaUrl } from '../api';

/**
 * Robust image component that:
 * 1. Normalizes backend/uploads/Cloudinary URLs via getMediaUrl
 * 2. Catches HTTP 404 / network errors and seamlessly displays high quality fallbacks
 * 3. Prevents infinite error loops and broken image placeholders
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
  ...props
}) {
  const [hasError, setHasError] = useState(false);

  // Reset error state if the src prop changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const imgOptions = props.width || (fallbackType === 'avatar' ? 'avatar' : 600);
  const resolved = getMediaUrl(src, imgOptions);

  const getFallback = () => {
    if (fallbackSrc) return fallbackSrc;
    if (fallbackType === 'avatar') {
      const cleanName = encodeURIComponent((alt || 'Campus User').trim().slice(0, 20));
      return `https://ui-avatars.com/api/?name=${cleanName}&background=0284c7&color=fff&bold=true&size=128`;
    }
    if (fallbackType === 'food') return '/campus_jollof.jpg';
    if (fallbackType === 'store') return '/campus_vendor.jpg';
    return '/campus_hero.jpg';
  };

  const finalSrc = !resolved || hasError ? getFallback() : resolved;

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (!hasError) setHasError(true);
      }}
      onClick={onClick}
      style={style}
      loading={loading}
      {...props}
    />
  );
}

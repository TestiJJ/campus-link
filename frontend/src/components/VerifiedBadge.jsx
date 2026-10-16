import React from 'react';

/**
 * VerifiedBadge
 * Official Blue Verification Checkmark (Twitter/Instagram/Facebook style blue tick).
 * Used for verified students, platform creators, verified campus vendors, and admins.
 */
export default function VerifiedBadge({
  size = 'md',
  className = '',
  title = 'Verified Campus Member',
  showTooltip = true
}) {
  const sizeMap = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6'
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
      title={showTooltip ? title : undefined}
      aria-label={title}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${currentSize} drop-shadow-2xs select-none`}
      >
        {/* Scalloped blue badge */}
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
          fill="#1D9BF0"
        />
        {/* Crisp checkmark */}
        <path
          d="M9.55 16.25l-3.8-3.8 1.41-1.41 2.39 2.39 6.5-6.5 1.41 1.41-7.91 7.91z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
}

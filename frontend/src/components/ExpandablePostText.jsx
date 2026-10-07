import React, { useState } from 'react';

/**
 * ExpandablePostText
 * Displays post text or media captions with an interactive "Read more" / "Show less"
 * toggle when the post content is long.
 *
 * @param {string} text - The raw text or caption of the post
 * @param {number} maxChars - Maximum characters before truncating (default: 220 for text, 140 for media)
 * @param {number} maxLines - Maximum line breaks before truncating (default: 4 for text, 3 for media)
 * @param {string} className - Additional CSS class names for styling
 * @param {boolean} isMediaCaption - Whether this text belongs to a media post (photo/video)
 */
export default function ExpandablePostText({
  text,
  maxChars = 220,
  maxLines = 4,
  className = '',
  isMediaCaption = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const effectiveMaxChars = isMediaCaption ? Math.min(maxChars, 140) : maxChars;
  const effectiveMaxLines = isMediaCaption ? Math.min(maxLines, 3) : maxLines;

  const lines = trimmed.split(/\r?\n/);
  const isLineExceeded = lines.length > effectiveMaxLines;
  const isCharExceeded = trimmed.length > effectiveMaxChars;
  const isLong = isCharExceeded || isLineExceeded;

  const baseTextClasses = className || (
    isMediaCaption
      ? 'text-xs sm:text-sm text-slate-800 leading-relaxed font-medium'
      : 'text-slate-800 text-sm sm:text-[15px] font-medium leading-relaxed'
  );

  // If text is short, render straightforwardly
  if (!isLong) {
    return (
      <p className={`${baseTextClasses} whitespace-pre-line select-text break-words`}>
        {trimmed}
      </p>
    );
  }

  // If currently expanded, show entire text with a "Show less" button
  if (isExpanded) {
    return (
      <div className="select-text">
        <p className={`${baseTextClasses} whitespace-pre-line inline break-words`}>
          {trimmed}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className="ml-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer transition-colors active:scale-95 inline-flex items-center"
          aria-label="Show less post content"
        >
          Show less
        </button>
      </div>
    );
  }

  // Calculate truncated text snippet cleanly near a word boundary
  let snippet = trimmed;
  if (isLineExceeded) {
    snippet = lines.slice(0, effectiveMaxLines).join('\n');
  }
  if (snippet.length > effectiveMaxChars) {
    const cut = snippet.slice(0, effectiveMaxChars);
    const lastSpace = cut.lastIndexOf(' ');
    snippet = (lastSpace > effectiveMaxChars * 0.7 ? cut.slice(0, lastSpace) : cut).trim();
  }

  return (
    <div className="select-text">
      <p className={`${baseTextClasses} whitespace-pre-line inline break-words`}>
        {snippet}
        <span className="text-slate-400 select-none">... </span>
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(true);
        }}
        className="text-xs sm:text-sm font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer transition-colors active:scale-95 inline-flex items-center ml-0.5"
        aria-label="Read more post content"
      >
        Read more
      </button>
    </div>
  );
}

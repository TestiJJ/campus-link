import React, { useState, useRef } from 'react';
import { Reply } from 'lucide-react';

export default function SwipeableMessageBubble({
  children,
  message,
  onSwipeReply,
  onReply,
  isMine = false,
  className = '',
  disabled = false
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [hasVibrated, setHasVibrated] = useState(false);
  
  const touchStartRef = useRef({ x: 0, y: 0, isLocked: false, isVertical: false });
  const bubbleRef = useRef(null);

  const TRIGGER_THRESHOLD = 45;
  const MAX_OFFSET = 65;

  const handlePointerDown = (e) => {
    if (disabled || e.button === 2) return; // Ignore right clicks or if disabled
    touchStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      isLocked: false,
      isVertical: false
    };
    setIsSwiping(true);
    setHasVibrated(false);
  };

  const handlePointerMove = (e) => {
    if (!touchStartRef.current || touchStartRef.current.isVertical) return;

    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;

    // Check gesture direction intent
    if (!touchStartRef.current.isLocked) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
        touchStartRef.current.isVertical = true;
        setOffsetX(0);
        return;
      }
      if (dx > 5 && Math.abs(dx) > Math.abs(dy)) {
        touchStartRef.current.isLocked = true;
        try {
          e.target.setPointerCapture?.(e.pointerId);
        } catch {}
      } else if (dx < -5) {
        // Ignore leftward drags
        return;
      }
    }

    if (touchStartRef.current.isLocked && dx > 0) {
      // Elastic resistance damping past trigger threshold
      let calculatedOffset = dx;
      if (dx > TRIGGER_THRESHOLD) {
        calculatedOffset = TRIGGER_THRESHOLD + (dx - TRIGGER_THRESHOLD) * 0.35;
      }
      calculatedOffset = Math.min(MAX_OFFSET, calculatedOffset);

      if (calculatedOffset >= TRIGGER_THRESHOLD && !hasVibrated) {
        setHasVibrated(true);
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(15);
          }
        } catch {}
      } else if (calculatedOffset < TRIGGER_THRESHOLD && hasVibrated) {
        setHasVibrated(false);
      }

      setOffsetX(calculatedOffset);
    }
  };

  const handlePointerUpOrCancel = (e) => {
    if (touchStartRef.current?.isLocked && offsetX >= TRIGGER_THRESHOLD) {
      if (onSwipeReply) {
        onSwipeReply();
      } else if (onReply && message) {
        onReply(message);
      } else if (onReply) {
        onReply();
      }
    }

    try {
      if (e.target.hasPointerCapture?.(e.pointerId)) {
        e.target.releasePointerCapture?.(e.pointerId);
      }
    } catch {}

    touchStartRef.current = null;
    setIsSwiping(false);
    setOffsetX(0);
    setHasVibrated(false);
  };

  const progress = Math.min(1, Math.max(0, offsetX / TRIGGER_THRESHOLD));
  const isTriggered = offsetX >= TRIGGER_THRESHOLD;

  return (
    <div className={`w-full flex ${isMine ? 'justify-end items-end' : 'justify-start items-start'} relative overflow-hidden group my-1 px-1 sm:px-2`}>
      {/* Swipe to Reply Curved Arrow Backing Indicator */}
      <div
        className={`absolute left-2 z-0 pointer-events-none flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 ${
          isTriggered
            ? 'bg-blue-600 text-white scale-110 shadow-sm'
            : 'bg-slate-200/80 text-slate-500 scale-90'
        }`}
        style={{
          opacity: progress,
          transform: `scale(${0.6 + progress * 0.4})`,
          transition: isSwiping ? 'none' : 'opacity 0.2s, transform 0.2s'
        }}
      >
        <Reply className={`w-4 h-4 transition-transform ${isTriggered ? 'scale-110 -rotate-12' : ''}`} />
      </div>

      {/* Actual Message Bubble with snappy spring release */}
      <div
        ref={bubbleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        className={`relative z-10 select-text flex flex-col ${isMine ? 'items-end' : 'items-start'} w-full max-w-full ${className}`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
          touchAction: 'pan-y'
        }}
      >
        {children}
      </div>
    </div>
  );
}

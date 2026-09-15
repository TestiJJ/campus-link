import React, { useRef, useEffect } from 'react';

/**
 * FeedVideoPlayer ensures:
 * 1. Scrolling away from a playing video pauses it immediately (IntersectionObserver).
 * 2. Only ONE video can play at a time across the feed — starting a video automatically
 *    pauses any other running video on the page.
 */
export default function FeedVideoPlayer({
  src,
  poster = null,
  className = 'w-full h-full object-contain',
  style = { maxHeight: '72vw', minHeight: '200px' },
  autoPlayOnVisible = false,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Pause all other videos when this one starts playing
    const handlePlay = () => {
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach((v) => {
        if (v !== video && !v.paused) {
          v.pause();
        }
      });
    };

    video.addEventListener('play', handlePlay);

    // IntersectionObserver to pause the video immediately when scrolled out of view
    let observer = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // When less than 40% of the video is visible or it leaves view entirely, pause it
            if (!entry.isIntersecting || entry.intersectionRatio < 0.4) {
              if (video && !video.paused) {
                video.pause();
              }
            } else if (autoPlayOnVisible && entry.intersectionRatio >= 0.7) {
              // Optional autoplay when well-centered
              if (video && video.paused) {
                video.play().catch(() => {});
              }
            }
          });
        },
        {
          threshold: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
          rootMargin: '0px 0px -50px 0px', // slight negative bottom margin triggers pause slightly before it exits
        }
      );

      observer.observe(video);
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [autoPlayOnVisible]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster || undefined}
      controls
      playsInline
      preload="metadata"
      className={className}
      style={style}
    />
  );
}

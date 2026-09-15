import { useState, useEffect, useMemo } from 'react';

/**
 * Hook to manage mobile viewport sizing and keyboard avoidance in chat views.
 * Prevents mobile browsers from scrolling/panning the outer page and displacing
 * the chat header when the virtual keyboard appears.
 *
 * @param {boolean} isChatOpen - true when an active chat conversation is open
 * @returns {{
 *   isMobile: boolean,
 *   viewportHeight: number | null,
 *   viewportTop: number,
 *   containerStyle: React.CSSProperties | undefined
 * }}
 */
export function useMobileChatViewport(isChatOpen) {
  const [viewportState, setViewportState] = useState(() => {
    if (typeof window === 'undefined') {
      return { isMobile: false, height: null, top: 0 };
    }
    const isMobile = window.innerWidth < 768;
    return {
      isMobile,
      height: isMobile ? Math.round(window.visualViewport?.height || window.innerHeight) : null,
      top: 0
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobile = () => window.innerWidth < 768;

    if (!isChatOpen) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      setViewportState(prev => {
        const isMob = checkMobile();
        if (prev.height !== null || prev.isMobile !== isMob) {
          return { isMobile: isMob, height: null, top: 0 };
        }
        return prev;
      });
      return;
    }

    const isMob = checkMobile();
    if (!isMob) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      setViewportState({ isMobile: false, height: null, top: 0 });
      return;
    }

    // Save previous overflow style
    const prevBodyOverflow = document.body.style.overflow;
    const prevDocOverflow = document.documentElement.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;

    // Lock page scrolling while chat is active on mobile
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const updateHeight = () => {
      const vv = window.visualViewport;
      const currentHeight = vv ? vv.height : window.innerHeight;
      const currentTop = vv ? vv.offsetTop : 0;

      // Keep window pinned at (0, 0)
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }

      setViewportState({
        isMobile: true,
        height: Math.round(currentHeight),
        top: Math.round(currentTop)
      });
    };

    updateHeight();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateHeight);
      vv.addEventListener('scroll', updateHeight);
    }
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);

    // Keep scroll locked if touch events or focus happen
    const preventWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('scroll', preventWindowScroll, { passive: true });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevDocOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      if (vv) {
        vv.removeEventListener('resize', updateHeight);
        vv.removeEventListener('scroll', updateHeight);
      }
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('scroll', preventWindowScroll);
    };
  }, [isChatOpen]);

  const containerStyle = useMemo(() => {
    if (!isChatOpen || !viewportState.isMobile || !viewportState.height) {
      return undefined;
    }
    return {
      position: 'fixed',
      top: `${viewportState.top}px`,
      left: 0,
      right: 0,
      height: `${viewportState.height}px`,
      maxHeight: `${viewportState.height}px`,
      width: '100%',
      zIndex: 50,
      backgroundColor: '#ffffff'
    };
  }, [isChatOpen, viewportState.isMobile, viewportState.height, viewportState.top]);

  return {
    isMobile: viewportState.isMobile,
    viewportHeight: viewportState.height,
    viewportTop: viewportState.top,
    containerStyle
  };
}

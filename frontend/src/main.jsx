import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Auto-recover from dynamic module chunk errors during app deployments / updates
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('CampusLink: New build detected via vite:preloadError. Auto-reloading page...');
    event.preventDefault();
    const reloadKey = 'cl_preload_err_reload';
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, 'true');
      window.location.reload();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = (event?.reason?.message || String(event?.reason || '')).toLowerCase();
    if (
      msg.includes('dynamically imported module') ||
      msg.includes('importing a module script failed') ||
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module')
    ) {
      console.warn('CampusLink: Module script import failure caught. Auto-reloading to fetch newest version...');
      event.preventDefault();
      const reloadKey = 'cl_unhandled_chunk_reload';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
      }
    }
  });
}

// Disable pinch-to-zoom and viewport scaling on mobile devices (iOS Safari & Android)
if (typeof window !== 'undefined') {
  try {
    // Prevent Safari iOS gesture events (pinch zoom & rotate)
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

    // Prevent multi-touch pinch zooming on iOS and Android touch screens
    document.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // Prevent double-tap to zoom on iOS and mobile browsers
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    // Prevent Ctrl + Mousewheel / Trackpad pinch zoom on laptops & desktops
    document.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    }, { passive: false });

    // Prevent Ctrl + +/-/0 zoom key shortcuts on laptops & desktops
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
      }
    });
  } catch (err) {
    console.warn('Touch event listener initialization note:', err);
  }
}

// Register PWA Service Worker for installable application & offline shell
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CHUNK_MISSING_RELOAD') {
      console.warn('CampusLink: Stale chunk 404 detected by service worker. Reloading to latest version...');
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('CampusLink PWA Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('CampusLink SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

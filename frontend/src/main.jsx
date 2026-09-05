import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

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

    // Prevent Ctrl + Mousewheel / Trackpad pinch zoom
    document.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    }, { passive: false });
  } catch (err) {
    console.warn('Touch event listener initialization note:', err);
  }
}

// Register PWA Service Worker for installable application & offline shell
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
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

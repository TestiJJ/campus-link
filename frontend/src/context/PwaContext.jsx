// src/context/PwaContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const PwaContext = createContext(null);

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
}

export function PwaProvider({ children }) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [updateNeeded, setUpdateNeeded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [latestVersion, setLatestVersion] = useState('2.4.1');
  const [swRegistration, setSwRegistration] = useState(null);
  const waitingWorkerRef = useRef(null);

  // 1. Check install status & platform
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
    }

    const ua = (window.navigator.userAgent || '').toLowerCase();
    const apple = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /android/.test(ua);

    setIsIos(apple);
    setIsAndroid(android);

    // Capture native install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('CampusLink: Captured beforeinstallprompt event.');
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('CampusLink PWA installed on device.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // 2. Service Worker lifecycle & update detection
  const checkForUpdates = useCallback(async () => {
    try {
      // A. Check Service Worker registration
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          setSwRegistration(reg);

          // If a service worker is already waiting, an update is ready right now!
          if (reg.waiting) {
            waitingWorkerRef.current = reg.waiting;
            setUpdateNeeded(true);
            return;
          }

          // Trigger background update check
          try {
            await reg.update();
          } catch (updateErr) {
            console.warn('CampusLink SW reg.update() note:', updateErr);
          }

          if (reg.waiting) {
            waitingWorkerRef.current = reg.waiting;
            setUpdateNeeded(true);
            return;
          }

          // Listen if a worker starts installing
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                waitingWorkerRef.current = installing;
                setUpdateNeeded(true);
              }
            });
          });
        }
      }

      // B. Check version.json for build differences
      try {
        const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.version) {
            setLatestVersion(data.version);
            const savedBuild = localStorage.getItem('campuslink_app_build');
            const currentBuildTime = data.buildTime || data.version;

            if (!savedBuild) {
              // Initial session baseline
              localStorage.setItem('campuslink_app_build', String(currentBuildTime));
            } else if (String(savedBuild) !== String(currentBuildTime)) {
              console.log('CampusLink: New build detected via version.json:', data.version);
              setUpdateNeeded(true);
            }
          }
        }
      } catch (_) {}
    } catch (err) {
      console.warn('CampusLink update check warning:', err);
    }
  }, []);

  useEffect(() => {
    checkForUpdates();

    // Check periodically every 60 seconds
    const interval = setInterval(checkForUpdates, 60000);

    // Check whenever tab becomes active
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdates]);

  // 3. Immediately implement update upon being clicked
  const applyUpdate = useCallback(async () => {
    setIsUpdating(true);

    try {
      // 1. Tell waiting service worker to skip waiting
      if (waitingWorkerRef.current) {
        waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
      } else if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // 2. Clear any browser cache storage so newest assets are fetched
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((k) => caches.delete(k)));
        } catch (cacheErr) {
          console.warn('Cache clearing error:', cacheErr);
        }
      }

      // 3. Update localStorage version baseline
      try {
        const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.buildTime || data.version)) {
            localStorage.setItem('campuslink_app_build', String(data.buildTime || data.version));
          }
        }
      } catch (_) {}

      // 4. Reload page immediately
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      }

      // Fallback reload if controllerchange doesn't fire immediately
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Failed to apply update:', err);
      window.location.reload();
    }
  }, [swRegistration]);

  // 4. Prompt installation
  const installApp = useCallback(async () => {
    // If update is needed, clicking it triggers update
    if (updateNeeded) {
      return applyUpdate();
    }

    // On iOS Safari
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    // On Android / Chrome with native prompt
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    // Fallback: If no direct prompt, show iOS guide or instructions
    if (isAndroid) {
      alert('To install CampusLink on Android, open your browser menu (⋮ three dots at top right) and tap "Install app" or "Add to Home screen".');
    } else {
      setShowIosGuide(true);
    }
  }, [updateNeeded, isIos, isAndroid, deferredPrompt, applyUpdate]);

  const value = {
    isInstalled,
    isIos,
    isAndroid,
    canInstall: !isInstalled,
    deferredPrompt,
    updateNeeded,
    isUpdating,
    latestVersion,
    showIosGuide,
    setShowIosGuide,
    installApp,
    applyUpdate,
    checkForUpdates
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

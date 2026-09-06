// CampusLink Service Worker (PWA Offline & SPA Shell Caching)
const CACHE_NAME = 'campuslink-v1.0.3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/pwa-icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

// Install: Pre-cache app shell & skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('CampusLink SW pre-cache partial warning:', err);
      });
    })
  );
});

// Activate: Clean up old cache versions & take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('CampusLink SW removing old cache version:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Robust strategy preventing unhandled rejections or invalid schemes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request || request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Strictly ignore unsupported schemes (e.g. chrome-extension://, blob:, data:, ws:)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Bypass API endpoints, auth routes, websockets, uploads, and backend origins entirely
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/api/') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/upload') ||
    url.pathname.startsWith('/docs') ||
    url.pathname.startsWith('/openapi.json') ||
    url.hostname.includes('onrender.com') ||
    url.origin !== self.location.origin
  ) {
    // Always let API and remote backend requests go straight to the network
    return;
  }

  // 1. Single Page Application (SPA) Navigations (HTML pages): Network-first with /index.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', clone).catch(() => {});
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback: Serve cached index.html or root
          const cached = await caches.match('/index.html') || await caches.match('/');
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html><head><title>CampusLink Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f8fafc;"><h2 style="color:#0284c7;">CampusLink Offline</h2><p style="color:#64748b;">Please check your internet connection and reload the page.</p><button onclick="window.location.reload()" style="background:#0284c7;color:#fff;border:none;padding:10px 20px;border-radius:12px;font-weight:bold;cursor:pointer;">Retry</button></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  // 2. Only cache same-origin static assets (JS, CSS, static images, icons, fonts)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-While-Revalidate: Return cached immediately, fetch fresh in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, clone).catch(() => {});
                }).catch(() => {});
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Cache miss: Fetch from network and cache for future
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone).catch(() => {});
              }).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => {
            // Return safe fallback if network fails
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
          });
      })
    );
  }
});

// ==========================================
// Native Web Push Notification Handlers
// ==========================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'CampusLink Alert',
    body: 'You have a new campus notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-icon.svg',
    url: '/',
    tag: 'campuslink-alert'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (_) {
      try {
        data.body = event.data.text() || data.body;
      } catch (__) {}
    }
  }

  const title = data.title || 'CampusLink';
  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-icon.svg',
    image: data.image || undefined,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
      ...(data.data || {})
    },
    tag: data.tag || `campuslink-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: false,
    actions: data.actions || [
      { action: 'open', title: 'Open CampusLink' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If there's an existing open tab for CampusLink, focus and navigate it
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          if (targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

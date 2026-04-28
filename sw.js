// Service Worker for Vet Buddies
const CACHE_NAME = 'vetbuddies-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/config.js',
  '/utils.js',
  '/resource-documents.js',
  '/app.js',
  '/manifest.json',
  '/favicon.ico',
];

// Install: pre-cache static shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip all third-party origins — let the browser handle them directly.
  // SW fetch() on cross-origin URLs is subject to connect-src CSP, which
  // blocks CDN/font origins. Returning without calling event.respondWith()
  // falls through to the browser's default network behaviour.
  if (url.origin !== self.location.origin) return;

  // App shell (same-origin static assets): network-first with cache fallback
  // This ensures users always get fresh code after deploys.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return resp;
      }).catch(() => {
        // Network failed — return cached version or offline fallback
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }
});

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || 'Vet Buddies';
    const options = {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: payload.tag || 'vetbuddies-push-' + Date.now(),
      renotify: true,
      data: { url: payload.url || '/', caseId: payload.caseId || null },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.warn('Push event parse error:', e);
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        const client = clientList[0];
        client.postMessage({ type: 'NOTIFICATION_CLICK', caseId: data.caseId || null });
        return client.focus();
      }
      return clients.openWindow(data.url || '/');
    })
  );
});

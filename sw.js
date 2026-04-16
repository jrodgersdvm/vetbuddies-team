// Service Worker for Vet Buddies
const CACHE_NAME = 'vetbuddies-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/config.js',
  '/utils.js',
  '/resource-documents.js',
  '/app.js',
  '/manifest.json',
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

  // Skip Supabase API, Stripe, and Anthropic calls — always go to network
  if (url.hostname.includes('supabase') || url.hostname.includes('stripe') || url.hostname.includes('anthropic')) return;

  // CDN scripts and fonts: cache-first (they're versioned)
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }

  // App shell (same-origin static assets): stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return resp;
        }).catch(() => {
          // Network failed — return cached version or offline fallback
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
        return cached || fetchPromise;
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

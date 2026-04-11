// Service Worker for Vet Buddies
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

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

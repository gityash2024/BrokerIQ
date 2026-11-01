/* BrokerIQ service worker: shows website push notifications and opens the right page on tap. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'BrokerIQ', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'BrokerIQ';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.notificationId || undefined,
      data: { notificationId: data.notificationId },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const id = event.notification.data && event.notification.data.notificationId;
  // Resolve the owned notification after login; never navigate an arbitrary push URL.
  const url = new URL(
    typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id) ? '/notification?notification=' + encodeURIComponent(id) : '/notification',
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          return w.navigate(url).then(() => w.focus());
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

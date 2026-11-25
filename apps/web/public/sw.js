// Web Push only: no offline caching, no fetch handler. Payload = { title, body, url, tag } (public text only).
/* global self */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* not JSON: show the default text */ }
  event.waitUntil((async () => {
    // A focused tab already shows the in-app toast; do not double it with a system notification.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.focused)) return;
    await self.registration.showNotification(data.title || 'بردگیم‌ورس', {
      body: data.body || 'اعلان تازه',
      tag: data.tag,
      data: { url: data.url || '/' },
      icon: '/icon-192.png',
      badge: '/favicon-48.png',
      lang: 'fa',
      dir: 'rtl'
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/';
  // Same-origin paths only.
  const target = new URL(raw.startsWith('/') && !raw.startsWith('//') ? raw : '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = wins.find((w) => w.url === target) || wins[0];
    if (same) {
      await same.focus();
      // navigate() works on controlled tabs only; otherwise open the target in a new one.
      if (same.url !== target) await same.navigate(target).catch(() => self.clients.openWindow(target));
      return;
    }
    await self.clients.openWindow(target);
  })());
});

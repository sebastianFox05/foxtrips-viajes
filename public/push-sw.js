/*
 * Avisos push dentro del service worker (lo carga el service worker de la PWA con importScripts).
 * El servidor envia JSON: { title, body, url, tag }.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const scope = self.registration.scope;
  event.waitUntil(self.registration.showNotification(data.title || 'FoxTrips', {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    icon: new URL('assets/img/icono-192.png', scope).href,
    badge: new URL('assets/img/favicon-48.png', scope).href,
    data: { url: new URL(String(data.url || '/').replace(/^\//, ''), scope).href }
  }));
});

/* Al pulsar el aviso: se usa una ventana abierta de la app o se abre una nueva en esa pantalla */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client) => client.url.startsWith(self.registration.scope));
    if (open) {
      await open.focus();
      if ('navigate' in open) return open.navigate(target).catch(() => null);
      return null;
    }
    return self.clients.openWindow(target);
  })());
});

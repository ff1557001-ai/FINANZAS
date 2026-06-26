// sw.js — Service Worker de Mis Finanzas
// Versión mínima: solo maneja notificaciones y cacheo básico.

const CACHE_NAME = 'finanzas-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Intercepta fetch solo para assets propios (no bloquea Sheets/Apps Script)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Solo cachear assets del mismo origen
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// Manejar notificaciones push (showNotification desde la página)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/FINANZAS/');
    })
  );
});

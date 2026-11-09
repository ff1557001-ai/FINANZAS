// Mis Finanzas · Service Worker
// - Guarda la app y Chart.js para que funcione sin conexión.
// - Archivos propios: se sirven desde caché al instante y se actualizan en segundo plano.
// - Google Sheets / Apps Script y cualquier otro dominio: pasan directo a la red (nunca se cachean).
// Al publicar cambios grandes, sube el número de versión para limpiar la caché anterior.
const VERSION = 'finanzas-v6';
const CHART_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
const SHELL = ['./', 'index.html', 'manifest.json',
               'favicon-32.png', 'icono-192.png', 'icon-192.png', CHART_URL];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // allSettled: si falta un icono, el resto igual se guarda
    await Promise.allSettled(SHELL.map(u => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n.startsWith('finanzas-') && n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(archivoPropio(req, e));
  else if (url.href === CHART_URL) e.respondWith(primeroCache(req));
  // el resto (Apps Script, Google Sheets, etc.) no se intercepta
});

async function archivoPropio(req, e) {
  const cache = await caches.open(VERSION);
  const guardado = await cache.match(req, { ignoreSearch: true });
  // no-cache: siempre pregunta al servidor si hay cambios (evita que GitHub Pages sirva una copia vieja hasta 10 min)
  const red = fetch(req, { cache: 'no-cache' }).then(async res => {
    if (res && res.ok && res.type === 'basic') {
      const antes = guardado && guardado.headers.get('etag');
      const ahora = res.headers.get('etag');
      await cache.put(req, res.clone());
      if (antes && ahora && antes !== ahora) avisarActualizacion();
    }
    return res;
  }).catch(() => null);

  if (guardado) { e.waitUntil(red); return guardado; }
  const res = await red;
  if (res) return res;
  return req.mode === 'navigate' ? (await cache.match('index.html')) || Response.error() : Response.error();
}

async function primeroCache(req) {
  const cache = await caches.open(VERSION);
  const guardado = await cache.match(req);
  if (guardado) return guardado;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function avisarActualizacion() {
  const clientes = await self.clients.matchAll({ type: 'window' });
  clientes.forEach(c => c.postMessage({ tipo: 'actualizado' }));
}

// Al tocar una notificación se abre o se enfoca la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const abierta = cs.find(c => 'focus' in c);
    return abierta ? abierta.focus() : self.clients.openWindow('./');
  }));
});

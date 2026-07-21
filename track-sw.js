/* Service worker для «Пути мастера» — офлайн-доступ, scope /track.
   HTML: network-first (свежие обновления), затем кэш. Статика: cache-first. */
const CACHE = 'track-v1';
const SHELL = ['/track', '/track-icon-192.png', '/track-icon-512.png', '/track-manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const isDoc = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isDoc) {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/track', copy)); return res; })
        .catch(() => caches.match('/track').then((r) => r || caches.match(req)))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200 && (req.url.includes('/track-icon') || req.url.includes('fonts.g'))) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});

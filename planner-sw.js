/* Service worker для планера — офлайн-доступ, scope /planner.
   HTML: network-first (свежие обновления), затем кэш.
   Остальное (иконки, шрифты): cache-first. */
const CACHE = 'planner-v1';
const SHELL = ['/planner', '/planner-icon-192.png', '/planner-icon-512.png', '/manifest-planner.json'];

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
    // network-first, чтобы правки подтягивались; офлайн — из кэша
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('/planner', copy));
        return res;
      }).catch(() => caches.match('/planner').then((r) => r || caches.match(req)))
    );
    return;
  }
  // cache-first для статики (иконки, шрифты)
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200 && (req.url.includes('/planner-icon') || req.url.includes('fonts.g'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});

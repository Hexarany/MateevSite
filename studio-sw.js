/* SW контент-студии — офлайн-оболочка, scope /studio.
   HTML: network-first. Данные (/api/scripts) не кэшируем — всегда свежие. */
const CACHE = 'studio-v1';
const SHELL = ['/studio', '/studio-icon-192.png', '/studio-icon-512.png', '/studio-manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return; // API — только сеть, без кэша
  const isDoc = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isDoc) {
    e.respondWith(fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put('/studio', c)); return res; }).catch(() => caches.match('/studio')));
    return;
  }
  e.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
    if (res && res.status === 200 && (req.url.includes('/studio-icon') || req.url.includes('fonts.g'))) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
    return res;
  }).catch(() => cached)));
});

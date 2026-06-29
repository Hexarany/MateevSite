const CACHE = "mateev-v2";
const STATIC = [
  "/",
  "/client",
  "/styles.css",
  "/script.js",
  "/manifest.json",
  "/favicon.svg",
  "/og-image.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // API и admin — всегда с сервера
  if (e.request.url.includes("/api/") || e.request.url.includes("/admin")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Push notifications (ready for server-side web-push) ────────────────
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data && e.data.text() }; }
  const title = data.title || "Mateev Spa Studio";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.tag || "mateev",
    data: { url: data.url || "/client" },
    requireInteraction: false
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/client";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(target) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});

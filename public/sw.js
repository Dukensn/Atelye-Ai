// Atelye AI service worker: makes the site installable and opens fast on weak connections.
// Pages: network first (always fresh), cached copy when offline. API calls are never cached.
const KACH = "atelier-v2";
const BAZ = ["/", "/espas", "/peye", "/style.css", "/enstale.js", "/logo.png", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(KACH).then((c) => c.addAll(BAZ)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== KACH).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const kopi = r.clone(); caches.open(KACH).then((c) => c.put(e.request, kopi)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("/espas"))),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow("/espas#pwofil"));
});

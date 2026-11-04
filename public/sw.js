const CACHE = 'sl-campo-v1';
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest'])),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== location.origin ||
    url.pathname.startsWith('/api') ||
    event.request.method !== 'GET'
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) ||
          (event.request.mode === 'navigate' ? await caches.match('/') : Response.error()),
      ),
  );
});

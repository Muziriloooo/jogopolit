const CACHE = 'sl-campo-v1';
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest'])),
  ),
);
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches.keys().then(async (keys) => {
      // Retain prior releases while another open tab finishes a visit.
      // Never delete unrelated applications' caches on the same origin.
      const previous = keys.filter((k) => k.startsWith('sl-campo-') && k !== CACHE);
      await Promise.all(previous.slice(0, -2).map((k) => caches.delete(k)));
      await self.clients.claim();
    }),
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
    (async () => {
      const cache = await caches.open(CACHE);
      if (url.pathname.startsWith('/assets/')) {
        const hit = await caches.match(event.request);
        if (hit) return hit;
      }
      try {
        const response = await fetch(event.request);
        if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
        return response;
      } catch {
        return (
          (await cache.match(event.request)) ||
          (event.request.mode === 'navigate' ? await cache.match('/') : undefined) ||
          Response.error()
        );
      }
    })(),
  );
});

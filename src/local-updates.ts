/** Local HTTP/Wi-Fi updates: no service worker or HTTPS required. */
export function watchLocalUpdates(options: {
  safeToReload: () => boolean;
  flush: () => Promise<unknown>;
  onWaiting: (waiting: boolean) => void;
}) {
  const initial = document.querySelector<HTMLMetaElement>('meta[name="sl-local-version"]')?.content;
  let disposed = false;
  let checking = false;
  let changed = false;
  let reloading = false;
  async function check() {
    if (disposed || checking || reloading || document.visibilityState === 'hidden') return;
    checking = true;
    try {
      const response = await fetch('/__sl/version', { cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      if (initial && result.version && result.version !== initial) changed = true;
      if (!changed) return;
      options.onWaiting(true);
      if (!options.safeToReload()) return;
      await options.flush();
      if (disposed || !options.safeToReload()) return;
      reloading = true;
      location.reload();
    } catch {
      // A sleeping phone or offline computer retries without touching local drafts.
    } finally {
      checking = false;
    }
  }
  // Remove only this application's old worker when returning to development.
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        for (const registration of registrations) {
          const worker = registration.active || registration.waiting || registration.installing;
          if (!worker) continue;
          const url = new URL(worker.scriptURL);
          if (url.origin === location.origin && url.pathname === '/sw.js') {
            await registration.unregister();
            if (navigator.serviceWorker.controller?.scriptURL === worker.scriptURL) changed = true;
          }
        }
      })
      .catch(() => {});
  }
  const visible = () => {
    if (document.visibilityState !== 'hidden') void check();
  };
  const interval = window.setInterval(check, 3000);
  window.addEventListener('online', visible);
  window.addEventListener('focus', visible);
  document.addEventListener('visibilitychange', visible);
  void check();
  return () => {
    disposed = true;
    window.clearInterval(interval);
    window.removeEventListener('online', visible);
    window.removeEventListener('focus', visible);
    document.removeEventListener('visibilitychange', visible);
  };
}

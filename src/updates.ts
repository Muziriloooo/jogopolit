/** Applies a published PWA release only after local work is durably saved and idle. */
export function watchUpdates(options: {
  safeToReload: () => boolean;
  flush: () => Promise<unknown>;
  onWaiting: (waiting: boolean) => void;
}) {
  let registration: ServiceWorkerRegistration | undefined;
  let disposed = false;
  let checking = false;
  let applying = false;
  let controllerChanged = false;
  let reloaded = false;
  // controllerchange during the first installation must not reload the login form.
  let lastController = navigator.serviceWorker.controller;
  const watched = new Set<ServiceWorker>();

  async function apply() {
    if (disposed || applying || reloaded || !navigator.onLine || !options.safeToReload()) return;
    if (!registration?.waiting && !controllerChanged) return;
    applying = true;
    try {
      await options.flush();
      if (disposed || !options.safeToReload()) return;
      if (controllerChanged) {
        reloaded = true;
        location.reload();
      } else registration?.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' });
    } catch {
      // A failed local write must leave the current version and draft intact.
    } finally {
      applying = false;
    }
  }
  function waiting() {
    if (registration?.waiting) {
      options.onWaiting(true);
      void apply();
    }
  }
  function track() {
    const worker = registration?.installing;
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener('statechange', waiting);
  }
  async function check() {
    if (disposed || checking || !navigator.onLine || document.visibilityState === 'hidden') return;
    checking = true;
    try {
      await registration?.update();
      waiting();
    } catch {
      // Offline/unavailable releases do not interrupt the running application.
    } finally {
      checking = false;
    }
  }
  function changed() {
    const next = navigator.serviceWorker.controller;
    const previous = lastController;
    lastController = next;
    if (!previous || next === previous) return;
    controllerChanged = true;
    options.onWaiting(true);
    void apply();
  }
  function visible() {
    if (document.visibilityState !== 'hidden') void check();
  }
  navigator.serviceWorker.addEventListener('controllerchange', changed);
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', visible);
  const checkTimer = window.setInterval(check, 60000);
  const applyTimer = window.setInterval(apply, 2000);
  void navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((r) => {
      if (disposed) return;
      registration = r;
      r.addEventListener('updatefound', track);
      track();
      waiting();
      void check();
    })
    .catch(() => {});
  return () => {
    disposed = true;
    window.clearInterval(checkTimer);
    window.clearInterval(applyTimer);
    navigator.serviceWorker.removeEventListener('controllerchange', changed);
    window.removeEventListener('online', check);
    window.removeEventListener('focus', check);
    document.removeEventListener('visibilitychange', visible);
    registration?.removeEventListener('updatefound', track);
    watched.forEach((worker) => worker.removeEventListener('statechange', waiting));
  };
}

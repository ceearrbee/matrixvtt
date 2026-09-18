/**
 * Noticing that a new build is ready, and letting it take over.
 *
 * The registration arrives as a parameter rather than being fetched
 * here, which is what makes the decision testable without a real
 * service worker.
 *
 * `hasController` is the condition the whole thing turns on. A worker
 * reaching `installed` with no controller is a first install, not an
 * update: there is nothing to replace, and prompting or reloading
 * would refresh a first-time visitor for no reason.
 */

const HANDOVER_TIMEOUT_MS = 5000;

/**
 * @param {any} registration
 * @param {{ onReady: (worker: any) => void, hasController: boolean }} opts
 * @returns {() => void} dispose
 */
export function watchForUpdate(registration, { onReady, hasController }) {
  if (!registration || !hasController) return () => {};

  let reported = false;
  const report = (worker) => {
    if (reported || !worker) return;
    reported = true;
    onReady(worker);
  };

  if (registration.waiting) report(registration.waiting);

  let watched = null;
  const onStateChange = () => {
    if (watched?.state === 'installed') report(watched);
  };
  const onUpdateFound = () => {
    watched?.removeEventListener?.('statechange', onStateChange);
    watched = registration.installing;
    watched?.addEventListener?.('statechange', onStateChange);
  };
  registration.addEventListener?.('updatefound', onUpdateFound);

  return () => {
    registration.removeEventListener?.('updatefound', onUpdateFound);
    watched?.removeEventListener?.('statechange', onStateChange);
  };
}

/**
 * Release the waiting worker and reload once it has control.
 *
 * @param {any} registration
 * @param {{ nav?: any, reload?: () => void }} [opts]
 */
export function acceptUpdate(registration, { nav, reload } = {}) {
  const target = nav ?? navigator.serviceWorker;
  const doReload = reload ?? (() => window.location.reload());
  const waiting = registration?.waiting;

  // Another tab may have accepted first, leaving nothing to release.
  if (!waiting) { doReload(); return; }

  let reloaded = false;
  const once = () => {
    if (reloaded) return;
    reloaded = true;
    doReload();
  };
  target?.addEventListener?.('controllerchange', once);
  // An install that cannot activate must not leave a dead button.
  setTimeout(once, HANDOVER_TIMEOUT_MS);
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

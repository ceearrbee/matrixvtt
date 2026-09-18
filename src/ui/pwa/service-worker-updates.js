/**
 * Wiring the update prompt to the real service worker.
 *
 * The only module here that touches `navigator`, and it takes it by
 * injection so the wiring is still testable.
 *
 * Standalone only. The widget entry registers no worker, but it is
 * served from the same origin and scope, so wiring this into shared
 * code would pop the banner inside the Element widget panel.
 *
 * In dev the inline registration unregisters everything, so
 * `getRegistration()` resolves undefined and nothing is wired. That is
 * the dev guard; there is no second hostname check to keep in step.
 */

import { watchForUpdate, acceptUpdate } from './update-watcher.js';
import { showUpdateBanner, hideUpdateBanner } from './update-banner.js';

/**
 * @param {{ nav?: any, container?: Element, reload?: () => void }} [opts]
 * @returns {Promise<() => void>} dispose
 */
export async function wireServiceWorkerUpdates({ nav, container, reload } = {}) {
  const sw = nav ?? globalThis.navigator?.serviceWorker;
  if (!sw?.getRegistration) return () => {};

  // Sampled before the await: a fast first install could otherwise
  // give this a controller and make the first install look like an
  // update.
  const hasController = !!sw.controller;

  let registration = null;
  try {
    registration = await sw.getRegistration();
  } catch { return () => {}; }
  if (!registration) return () => {};

  const dispose = watchForUpdate(registration, {
    hasController,
    onReady: () => showUpdateBanner(container ?? document.body,
      () => acceptUpdate(registration, { nav: sw, reload })),
  });

  return () => {
    dispose();
    hideUpdateBanner();
  };
}

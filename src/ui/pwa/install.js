/**
 * Holding the browser's install offer until the player asks for it.
 *
 * `beforeinstallprompt` fires once and early, and cannot be raised on
 * demand, so the event is captured and kept. Its default is prevented
 * so the offer appears where the app chooses rather than as the
 * browser's own bar.
 *
 * Kept in its own module, like `library/availability.js`, so a menu
 * item can gate on it without importing anything heavier.
 */

let prompt = null;

export function captureInstallPrompt(event) {
  event?.preventDefault?.();
  prompt = event ?? null;
}

export function installAvailable() {
  return prompt !== null;
}

/**
 * Show the browser's prompt. The event is spent either way: it cannot
 * be shown twice, so holding it after use would leave a button that
 * does nothing.
 */
export async function promptInstall() {
  const pending = prompt;
  prompt = null;
  await pending?.prompt?.();
}

/** Test seam. */
export function resetInstallPrompt() {
  prompt = null;
}

export function listenForInstallPrompt(target = window) {
  const onPrompt = (e) => captureInstallPrompt(e);
  target.addEventListener('beforeinstallprompt', onPrompt);
  return () => target.removeEventListener('beforeinstallprompt', onPrompt);
}

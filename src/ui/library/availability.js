/**
 * Whether the content library is usable in the current runtime. Standalone
 * (app) mode exposes a raw MatrixClient via ClientManager; widget mode
 * returns null and hides the feature. Kept in its own module so action-row
 * buttons can gate without importing the browser modal.
 */

export function libraryAvailable(ui) {
  const wm = ui?.widgetManager;
  return !!wm?.isAppClient && !!wm.getMatrixClient?.();
}

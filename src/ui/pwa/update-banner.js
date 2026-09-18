/**
 * The bar that offers a reload when a new build is ready.
 *
 * Follows `sync/offline-banner.js`: the module owns the node and takes
 * it down itself, so there is no document-lookup leak path. The data
 * attribute is a stable selector for tests and devtools, not the
 * module's own handle on the element.
 *
 * `role="status"`, not alert. Nothing is wrong.
 */

let bannerEl = null;

export function showUpdateBanner(container, onReload) {
  if (bannerEl) return;

  bannerEl = document.createElement('div');
  bannerEl.setAttribute('data-pwa-update-banner', '');
  bannerEl.setAttribute('role', 'status');
  bannerEl.setAttribute('aria-live', 'polite');
  bannerEl.className = 'pwa-update-banner';

  const text = document.createElement('span');
  text.textContent = 'A new version of MatrixVTT is ready.';

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'dbt dbt--sm btn-primary';
  reload.setAttribute('data-pwa-update-reload', '');
  reload.textContent = 'Reload';
  reload.addEventListener('click', () => {
    if (typeof onReload === 'function') onReload();
  });

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'dbt dbt--sm';
  dismiss.setAttribute('data-pwa-update-dismiss', '');
  dismiss.textContent = 'Later';
  dismiss.addEventListener('click', hideUpdateBanner);

  bannerEl.append(text, reload, dismiss);
  container.appendChild(bannerEl);
}

export function hideUpdateBanner() {
  bannerEl?.remove();
  bannerEl = null;
}

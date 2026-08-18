/**
 * Docs links. The VitePress site ships under ${BASE_URL}docs/ in
 * production builds (deploy.yml and package.sh run docs:build), but
 * `npm run dev` never builds it - the SPA fallback served a widget
 * shell stuck on a spinner. Dev links go to the deployed site instead.
 */

export const DEPLOYED_DOCS_URL = 'https://ceearrbee.github.io/matrixvtt/docs/';

/**
 * @param {string} [path] path under docs/, no leading slash
 * @param {{dev?: boolean, base?: string}} [opts] injectable for tests
 */
export function docsHref(path = '', {
  dev = !!import.meta.env?.DEV,
  base = import.meta.env?.BASE_URL || '/',
} = {}) {
  return dev ? `${DEPLOYED_DOCS_URL}${path}` : `${base}docs/${path}`;
}

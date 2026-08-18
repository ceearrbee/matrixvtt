/**
 * Resolve a Matrix content URI (`mxc://server/id`) to a downloadable HTTP
 * URL. Non-mxc values (https, built-in icon paths) pass through unchanged.
 * When no homeserver is supplied, the media server host embedded in the
 * mxc uri is used as a best-effort fallback.
 */

export function resolveMediaUrl(url, homeserver) {
  if (!url) return null;
  if (!url.startsWith('mxc://')) return url;
  const path = url.slice(6);
  const base = homeserver || `https://${path.split('/')[0]}`;
  return `${base}/_matrix/media/v3/download/${path}`;
}

/**
 * Hosts where plaintext http:// is acceptable: local development
 * homeservers (docs/SETUP.md runs Synapse on localhost:8008). Every
 * other host gets upgraded to https so credentials never travel
 * plaintext.
 */
export function isLocalHost(host) {
  const hostname = String(host || '').split(':')[0].toLowerCase();
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return true;
  return hostname.endsWith('.local');
}

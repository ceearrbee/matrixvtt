/**
 * Label for the header connection chip. When reconnecting, surface the
 * queued-write count (the same value the sync banner shows) so the chip
 * conveys progress instead of an inert "Reconnecting…". `Live` ignores the
 * queue - once connected the queue drains on its own.
 */
export function syncChipText(ok, queueCount) {
  if (ok) return 'Live';
  if (queueCount > 0) return `Reconnecting · ${queueCount} queued`;
  return 'Reconnecting…';
}

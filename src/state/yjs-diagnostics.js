/**
 * Read-only diagnostics over the live Y.Doc for Settings > About.
 * Doc compaction is gated on what real campaigns measure here; the
 * readout is the instrument, not the compaction.
 */

import * as Y from 'yjs';

export function yjsDocDiagnostics(doc) {
  if (!doc) return null;
  const encodedBytes = Y.encodeStateAsUpdate(doc).length;
  const vector = Y.decodeStateVector(Y.encodeStateVector(doc));
  let totalClock = 0;
  for (const clock of vector.values()) totalClock += clock;
  return { encodedBytes, clients: vector.size, totalClock };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

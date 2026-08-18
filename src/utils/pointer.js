/**
 * Coarse-pointer detection for copy decisions: touch-first devices get
 * "long-press" instructions where mouse users get "right-click".
 */
export function isCoarsePointer() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
}

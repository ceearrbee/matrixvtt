/**
 * Single source of truth for "should this animate?". CSS handles its
 * own side via the media query and the .reduced-motion class; JS-driven
 * animation (Konva tweens) must ask here so the in-app toggle works on
 * the map too, not just on DOM transitions.
 */
export function prefersReducedMotion() {
  if (document.documentElement.classList.contains('reduced-motion')) return true;
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

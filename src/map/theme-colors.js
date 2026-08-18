/**
 * src/map/theme-colors.js - read CSS-variable theme values into a flat
 * object the Konva layers can use without re-running `getComputedStyle`
 * each frame.
 */

import { HP_COLORS } from '../utils/ui-constants.js';

export function readThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
  return {
    mapFloor: read('--color-map-floor', '#1a2035'),
    gridLine: read('--color-grid-line', 'rgba(255, 255, 255, 0.08)'),
    hpGood: read('--color-text-success', HP_COLORS.GOOD),
    hpWarn: read('--color-text-warning', HP_COLORS.WARN),
    hpDanger: read('--color-text-danger', HP_COLORS.DANGER),
    textInverse: read('--color-text-inverse', '#ffffff'),
    // Speech-bubble palette. Kept distinct from `textInverse` so themes
    // that style chat surfaces differently (e.g. high-contrast) don't
    // tie the bubble to the inverse-text colour by accident.
    bubbleBg: read('--color-background-secondary', 'rgba(0, 0, 0, 0.78)'),
    bubbleBorder: read('--color-border-primary', 'rgba(255, 255, 255, 0.5)'),
    bubbleText: read('--color-text-primary', '#ffffff'),
    // Nondescript weights map labels up for legibility on its lighter
    // palette; other themes leave this unset (normal).
    tokenLabelWeight: read('--map-token-label-weight', 'normal'),
  };
}

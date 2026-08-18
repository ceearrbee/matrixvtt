/**
 * ui-constants - pure data constants shared by UI + render code.
 * No runtime dependencies; safe to import anywhere.
 */

export const HP_COLORS = {
  GOOD:   '#1D9E75',
  WARN:   '#EF9F27',
  DANGER: '#E24B4A',
};

export const DEFAULT_PING_COLOR = '#ff4444';

// Modal widths use `min(vw, px)` so dialogs make use of a widescreen
// desktop without overflowing a narrow window; phones force full-screen
// via the ≤768px media query regardless.
export const MODAL_WIDTHS = {
  LARGE:  'min(94vw, 940px)',
  MEDIUM: 'min(92vw, 680px)',
  SMALL:  'min(90vw, 460px)',
};

export const FOG_MODES = {
  VISIBLE: 'visible',
  GM_ONLY: 'gm_only',
  HIDDEN:  'hidden',
};

// Token + map-action palette. Kept distinct from HP_COLORS because these are
// static presets (default aura, side-tag defaults, area-select strokes) -
// not derived from theme CSS variables.
export const TOKEN_COLORS = {
  AURA_DEFAULT: '#4a9eff',
  PC_DEFAULT:   '#185FA5',
  NPC_DEFAULT:  '#993C1D',
  AREA_REVEAL:  '#4a9eff',
  AREA_HIDE:    '#ff6b6b',
};

// Swatch palette for the TokenFormModal color picker. First two slots
// share the named PC / NPC defaults so a swatch click matches what the
// panel-side createToken path produces with no explicit color.
export const TOKEN_SWATCHES = [
  TOKEN_COLORS.PC_DEFAULT,  '#534AB7', '#0F6E56', '#3B6D11',
  TOKEN_COLORS.NPC_DEFAULT, '#791F1F', '#C77700', '#1565C0',
  '#0F6E56', '#7A2E12', '#5A1010', '#666666',
];

/**
 * WCAG contrast gate for the four-theme token contract. CI's axe run
 * gates rendered surfaces; this suite gates the token pairs directly
 * so a theme edit cannot ship an unreadable combination.
 *
 * Checked pairs are the system's canonical text-on-surface uses:
 * body text on the three surface levels, and each status color on the
 * surface it labels plus its own tint.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const THEMES = ['dark', 'light', 'high-contrast', 'nondescript'];

function parseTokens(theme) {
  const css = readFileSync(`${process.cwd()}/src/themes/${theme}.css`, 'utf8');
  const tokens = {};
  for (const [, name, value] of css.matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!(name in tokens)) tokens[name] = value.trim();
  }
  return tokens;
}

function resolve(tokens, name, depth = 0) {
  const value = tokens[name];
  if (!value || depth > 5) return null;
  const alias = value.match(/^var\((--color-[\w-]+)\)$/);
  return alias ? resolve(tokens, alias[1], depth + 1) : value;
}

function parseColor(value) {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const hex3 = value.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [r, g, b] = hex3[1].split('').map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  const inner = value.match(/^rgba?\(([^)]*)\)$/);
  if (inner) {
    const parts = inner[1].split(',').map((p) => Number(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
    }
  }
  return null;
}

function compositeOver(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  const mix = (f, b) => (f * fg.a + b * bg.a * (1 - fg.a)) / (a || 1);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
}

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Contrast of a (possibly translucent) text token over a (possibly
 * translucent) surface token, both composited over the theme's primary
 * background, which is what actually sits behind them at runtime.
 */
function tokenRatio(tokens, textName, surfaceName) {
  const base = parseColor(resolve(tokens, '--color-background-primary'));
  const surfaceRaw = parseColor(resolve(tokens, surfaceName));
  const textRaw = parseColor(resolve(tokens, textName));
  if (!base || !surfaceRaw || !textRaw) return null;
  const surface = compositeOver(surfaceRaw, base);
  const text = compositeOver(textRaw, surface);
  return ratio(text, surface);
}

const BODY_PAIRS = [
  ['--color-text-primary', '--color-background-primary'],
  ['--color-text-primary', '--color-background-secondary'],
  ['--color-text-primary', '--color-background-tertiary'],
  ['--color-text-secondary', '--color-background-primary'],
  ['--color-text-secondary', '--color-background-secondary'],
  ['--color-text-tertiary', '--color-background-primary'],
  ['--color-text-tertiary', '--color-background-secondary'],
];

const STATUS_PAIRS = [
  ['--color-text-info', '--color-background-info'],
  ['--color-text-success', '--color-background-success'],
  ['--color-text-warning', '--color-background-warning'],
  ['--color-text-danger', '--color-background-danger'],
];

for (const theme of THEMES) {
  describe(`${theme} theme contrast`, () => {
    const tokens = parseTokens(theme);

    it.each(BODY_PAIRS)('%s on %s reaches 4.5:1', (text, surface) => {
      const r = tokenRatio(tokens, text, surface);
      expect(r, `${text} on ${surface}`).not.toBeNull();
      expect(r, `${text} on ${surface} = ${r?.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });

    it.each(STATUS_PAIRS)('%s on %s reaches 4.5:1', (text, surface) => {
      const r = tokenRatio(tokens, text, surface);
      expect(r, `${text} on ${surface}`).not.toBeNull();
      expect(r, `${text} on ${surface} = ${r?.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });
  });
}

/**
 * Non-text contrast (WCAG 1.4.11, 3:1). The focus indicator must be
 * discernible in every theme. High Contrast is the one theme whose
 * entire purpose is boundary visibility, so its neutral and status
 * borders are gated too; Dark/Light/Nondescript hairlines are
 * deliberate decorative separation (component identification there
 * comes from fill, ink, and layout) and stay ungated - raising every
 * hairline would repaint the whole almanac aesthetic.
 */
const HC_BORDER_TOKENS = [
  '--color-border-primary', '--color-border-secondary', '--color-border-tertiary',
  '--color-border-info', '--color-border-success', '--color-border-warning', '--color-border-danger',
];

for (const theme of THEMES) {
  describe(`${theme} focus indicator (non-text 3:1)`, () => {
    const tokens = parseTokens(theme);
    it.each([
      '--color-background-primary', '--color-background-secondary', '--color-background-tertiary',
    ])('--color-focus on %s reaches 3:1', (surface) => {
      const r = tokenRatio(tokens, '--color-focus', surface);
      expect(r, `--color-focus on ${surface}`).not.toBeNull();
      expect(r, `--color-focus on ${surface} = ${r?.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    });
  });
}

describe('high-contrast borders (non-text 3:1)', () => {
  const tokens = parseTokens('high-contrast');
  it.each(HC_BORDER_TOKENS)('%s reaches 3:1 on the primary background', (border) => {
    const r = tokenRatio(tokens, border, '--color-background-primary');
    expect(r, `${border} = ${r?.toFixed(2)}`).toBeGreaterThanOrEqual(3);
  });
});

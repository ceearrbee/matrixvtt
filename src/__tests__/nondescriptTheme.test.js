/**
 * Nondescript theme - locks in the wire-up across the theme system.
 *
 * The theme is a brutalist black/white palette mirroring
 * https://nondescript.design and its sister marketing-page mockup.
 * It uses prefers-color-scheme internally for the light/dark split,
 * so picking 'nondescript' inherits the user's OS preference within
 * the palette.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function read(rel) {
  return readFileSync(resolve(import.meta.dirname, rel), 'utf8');
}

describe('Theme: nondescript', () => {
  it('is in the VALID_THEMES list (settings-helpers.js)', () => {
    const src = read('../ui/settings-helpers.js');
    expect(src).toMatch(/VALID_THEMES\s*=\s*\[[^\]]*['"]nondescript['"]/);
  });

  it('is in the toggle cycle (theme.js)', () => {
    const src = read('../ui/theme.js');
    expect(src).toMatch(/nondescript/);
  });

  it('is in the global-menu toggle cycle and labels', () => {
    const src = read('../ui/global-menu-items.js');
    expect(src).toMatch(/THEME_NEXT[^=]*=[^;]*nondescript/);
    expect(src).toMatch(/THEME_LABELS[^=]*=[^;]*nondescript/);
  });

  it('is a selectable <option> in the accessibility panel', () => {
    const src = read('../ui/AccessibilityPanel.jsx');
    expect(src).toMatch(/value:\s*['"]nondescript['"]/);
  });

  it('has a CSS palette file with the mockup colors', () => {
    // Themes are per-file modules; the nondescript palette lives at
    // src/themes/nondescript.css and is @imported from styles.css.
    const css = read('../themes/nondescript.css');
    expect(css).toMatch(/data-theme="nondescript"/);
    expect(css).toMatch(/#FFFFFF|#ffffff/);
    expect(css).toMatch(/#111111|#111/);
    // Dark inverse keyed off prefers-color-scheme.
    expect(css).toMatch(/prefers-color-scheme:\s*dark[\s\S]*data-theme="nondescript"/);
  });

  it('is registered in styles.css via @import', () => {
    const css = read('../styles.css');
    expect(css).toMatch(/@import url\(['"]\.\/themes\/nondescript\.css['"]\)/);
  });

  describe('editorial vocabulary tokens', () => {
    // The Nondescript theme is being promoted from a colour-only palette
    // to the full editorial vocabulary (hairline borders, tighter spacing,
    // flat chrome, sharper corners, heavier token labels). These tokens
    // are declared in the theme so consumers in styles.css can pick them
    // up; defaults live at :root in styles.css.
    const css = read('../themes/nondescript.css');

    it('clamps border-radius to 3px in the editorial vocabulary', () => {
      expect(css).toMatch(/--border-radius-sm:\s*3px/);
      expect(css).toMatch(/--border-radius-md:\s*3px/);
      expect(css).toMatch(/--border-radius-lg:\s*3px/);
    });

    it('tightens the spacing scale', () => {
      // The editorial chassis is denser than the default scale.
      // Lock in the new values so styling regressions are caught.
      expect(css).toMatch(/--space-2xs:\s*1px/);
      expect(css).toMatch(/--space-xs:\s*3px/);
      expect(css).toMatch(/--space-sm:\s*5px/);
      expect(css).toMatch(/--space-md:\s*7px/);
      expect(css).toMatch(/--space-lg:\s*9px/);
      expect(css).toMatch(/--space-xl:\s*11px/);
      expect(css).toMatch(/--space-2xl:\s*14px/);
      expect(css).toMatch(/--space-3xl:\s*18px/);
      expect(css).toMatch(/--space-4xl:\s*22px/);
    });

    it('weights map token labels for legibility against the lighter palette', () => {
      expect(css).toMatch(/--map-token-label-weight:\s*600/);
    });

    it('the token-label weight is actually consumed by the map', async () => {
      const { readThemeColors } = await import('../map/theme-colors.js');
      document.documentElement.style.setProperty('--map-token-label-weight', '600');
      try {
        expect(readThemeColors().tokenLabelWeight).toBe('600');
      } finally {
        document.documentElement.style.removeProperty('--map-token-label-weight');
      }
      const tokensLayer = read('../map/layers/tokens.js');
      expect(tokensLayer).toMatch(/fontStyle\([^)]*tokenLabelWeight/);
    });
  });
});

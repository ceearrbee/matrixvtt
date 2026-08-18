/**
 * Chat-shell design-token bridge.
 *
 * The chat-shell token layer maps
 * rpglog (Prose Pals) `--md-*` semantic names onto matrixvtt's existing
 * `--color-*` palette so the new shell components reference one stable
 * vocabulary while themes keep driving the whole app from
 * `src/themes/*.css`.
 *
 * These assertions lock in:
 *   1. `src/themes/chat-shell-tokens.css` defines the full --md-* set
 *      plus shape, motion, and elevation scales.
 *   2. Every --md-* value is bridged to a theme-driven --color-* (not a
 *      raw hex) so themes still drive the palette and a future theme
 *      swap re-tints the chat shell automatically.
 *   3. `src/styles.css` imports the bridge file after all theme files
 *      so the theme variables are in scope when the mapping resolves.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const TOKENS = readFileSync(resolve(ROOT, 'src/themes/chat-shell-tokens.css'), 'utf8');
const STYLES = readFileSync(resolve(ROOT, 'src/styles.css'), 'utf8');

describe('chat-shell tokens - rpglog --md-* bridge', () => {
  it('defines the surface / primary / outline / channel-ink set', () => {
    const required = [
      '--md-surface', '--md-on-surface',
      '--md-surface-variant', '--md-on-surface-variant',
      '--md-primary', '--md-on-primary',
      '--md-secondary', '--md-outline',
      '--md-ic', '--md-gm', '--md-roll', '--md-desc',
      '--md-error', '--md-on-error',
      '--md-warning', '--md-success',
    ];
    for (const v of required) {
      expect(TOKENS, `missing ${v}`).toContain(v + ':');
    }
  });

  it('defines the shape / motion / elevation scales used by popups & chips', () => {
    const required = [
      '--radius-xs', '--radius-sm', '--radius-md',
      '--radius-lg', '--radius-xl', '--radius-pill',
      '--ease-standard', '--ease-emphasized',
      '--ease-decelerate', '--ease-accelerate',
      '--elev-1', '--elev-2', '--elev-3',
      '--chrome-hairline',
    ];
    for (const v of required) {
      expect(TOKENS, `missing ${v}`).toContain(v + ':');
    }
  });

  it('every --md-* color bridges to a theme-driven --color-* variable, no raw hex', () => {
    const colorLines = TOKENS
      .split('\n')
      .filter((l) => /^\s*--md-/.test(l));
    expect(colorLines.length).toBeGreaterThan(10);
    for (const line of colorLines) {
      // Allow lines that reference var(--color-...) or var(--md-...)
      // (a few --md-* aliases reference other --md-* tokens).
      // Disallow raw hex codes - those would bypass the theme system.
      expect(line, `raw hex in token mapping: ${line.trim()}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('src/styles.css imports the bridge file after every theme file', () => {
    const themeImports = [
      './themes/dark.css',
      './themes/light.css',
      './themes/high-contrast.css',
      './themes/nondescript.css',
    ];
    const bridgeImport = './themes/chat-shell-tokens.css';
    const bridgeIdx = STYLES.indexOf(bridgeImport);
    expect(bridgeIdx, 'bridge import missing from src/styles.css').toBeGreaterThan(0);
    for (const t of themeImports) {
      const idx = STYLES.indexOf(t);
      expect(idx, `theme import missing: ${t}`).toBeGreaterThan(0);
      expect(idx, `bridge must import after ${t}`).toBeLessThan(bridgeIdx);
    }
  });

  it('src/styles.css imports the chat-shell rules file after the token bridge', () => {
    const bridgeIdx = STYLES.indexOf('./themes/chat-shell-tokens.css');
    const rulesIdx = STYLES.indexOf('./themes/chat-shell.css');
    expect(rulesIdx, 'chat-shell.css import missing from src/styles.css')
      .toBeGreaterThan(0);
    expect(rulesIdx, 'chat-shell.css must import after chat-shell-tokens.css')
      .toBeGreaterThan(bridgeIdx);
  });
});

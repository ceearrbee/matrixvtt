/**
 * Two defects locked in here:
 *
 *  1. The inline preload script in app.html must read the canonical
 *     accessibility key (`vtt:accessibility`) - not the stale
 *     `vtt-theme` key. The runtime saves theme inside a JSON blob at
 *     `vtt:accessibility.theme`; reading the wrong key causes a FOUC
 *     on every reload and silently drops the user's preference.
 *
 *  2. The standalone bootstrap must invoke `applyAccessibilitySettings`
 *     at module load (widget mode does this in `src/app.js`). Without
 *     it, the runtime apply never happens on standalone - only the
 *     inline preload runs, and any later theme toggle is lost on the
 *     next reload because nothing re-applies on hydration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { STORAGE_KEYS } from '../utils/constants.js';

const ROOT = resolve(import.meta.dirname, '../..');

describe('theme - preload + standalone wiring', () => {
  it('app.html inline preload reads from vtt:accessibility, not vtt-theme', () => {
    const html = readFileSync(resolve(ROOT, 'app.html'), 'utf8');
    expect(html).toContain(STORAGE_KEYS.ACCESSIBILITY);
    // The legacy key must not be the one driving the preload anymore.
    // It's still allowed to appear elsewhere (constants, dead theme.js),
    // just not inside the inline preload script.
    const preloadMatch = html.match(/<script>([^<]*localStorage[^<]*data-theme[^<]*)<\/script>/);
    expect(preloadMatch, 'theme preload script not found').not.toBeNull();
    expect(preloadMatch[1]).toContain(STORAGE_KEYS.ACCESSIBILITY);
    expect(preloadMatch[1]).not.toContain("'vtt-theme'");
  });

  it('src/app-client.js imports and calls applyAccessibilitySettings on boot', () => {
    const src = readFileSync(resolve(ROOT, 'src/app-client.js'), 'utf8');
    expect(src).toMatch(/import\s*\{[^}]*applyAccessibilitySettings[^}]*\}\s*from\s*['"][^'"]*settings-helpers/);
    expect(src).toMatch(/applyAccessibilitySettings\s*\(\s*\)/);
  });
});

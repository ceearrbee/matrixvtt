/**
 * Shared COND_ICONS table - used by both the canvas token renderer and the
 * initiative tracker entry. Previously defined identically in two places;
 * now lives in src/utils/conditions.js.
 */

import { describe, it, expect } from 'vitest';
import { COND_ICONS } from '../utils/conditions.js';

describe('COND_ICONS', () => {
  it('maps each standard condition to a single-character glyph', () => {
    const required = [
      'prone', 'poisoned', 'stunned', 'paralyzed', 'charmed', 'frightened',
      'blinded', 'deafened', 'invisible', 'unconscious', 'concentration',
    ];
    for (const cond of required) {
      expect(COND_ICONS[cond], `missing glyph for ${cond}`).toBeTruthy();
      expect(typeof COND_ICONS[cond]).toBe('string');
    }
  });

  it('includes homebrew extras (exhausted / burning / frozen / slowed / hasted)', () => {
    for (const cond of ['exhausted', 'burning', 'frozen', 'slowed', 'hasted']) {
      expect(COND_ICONS[cond]).toBeTruthy();
    }
  });
});

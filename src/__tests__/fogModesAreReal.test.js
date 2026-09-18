/**
 * Fog has two modes, not three.
 *
 * `gm_only` was declared but no renderer or reader ever checked for
 * it: the fog layer and the visibility reader branch on `hidden`
 * alone, and the GM toggle flips between hidden and visible. A third
 * mode nothing implements is a promise the map cannot keep.
 */

import { describe, it, expect } from 'vitest';
import { FOG_MODES } from '../utils/ui-constants.js';

describe('FOG_MODES', () => {
  it('declares only the modes the renderer implements', () => {
    expect(Object.keys(FOG_MODES).sort()).toEqual(['HIDDEN', 'VISIBLE']);
  });

  it('has no gm_only value left behind', () => {
    expect(Object.values(FOG_MODES)).not.toContain('gm_only');
  });
});

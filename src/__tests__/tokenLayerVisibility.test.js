/**
 * Tokens with layer:'gm' are filtered out for non-GM viewers.
 * Default layer (undefined or 'tokens') is visible to everyone.
 */

import { describe, it, expect } from 'vitest';
import { visibleTokensForViewer } from '../utils/tokenLayer.js';

describe('visibleTokensForViewer', () => {
  const tokens = new Map([
    ['t-normal',  { id: 't-normal' }],                   // no layer → public
    ['t-tokens',  { id: 't-tokens',  layer: 'tokens' }], // explicit public
    ['t-gm',      { id: 't-gm',      layer: 'gm' }],     // GM-only
    ['t-bg',      { id: 't-bg',      layer: 'background' }],
    ['t-fg',      { id: 't-fg',      layer: 'foreground' }],
  ]);

  it('GM sees every token regardless of layer', () => {
    const ids = visibleTokensForViewer(tokens, { isGM: true }).map(t => t.id);
    expect(ids).toEqual(['t-normal', 't-tokens', 't-gm', 't-bg', 't-fg']);
  });

  it('non-GM sees public, background, foreground - not gm layer', () => {
    const ids = visibleTokensForViewer(tokens, { isGM: false }).map(t => t.id);
    expect(ids).toEqual(['t-normal', 't-tokens', 't-bg', 't-fg']);
    expect(ids).not.toContain('t-gm');
  });

  it('rejects unknown layer values as public (safe default)', () => {
    const m = new Map([['x', { id: 'x', layer: 'weird-value' }]]);
    const ids = visibleTokensForViewer(m, { isGM: false }).map(t => t.id);
    expect(ids).toEqual(['x']);
  });
});

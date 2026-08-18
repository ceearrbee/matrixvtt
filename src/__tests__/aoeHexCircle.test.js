/**
 * Circle AoE templates count cube-distance on hex grids.
 * On a square grid, a 10ft (= 2 cell) radius circle includes tokens
 * within √(2²+2²) ≈ 2.8 cells; on a hex grid it includes only hexes
 * within 2 hex-steps. The visual circle remains the same; only the
 * "tokens hit" set changes.
 */
import { describe, it, expect } from 'vitest';
import { getTokensInCircle } from '../utils/geometry.js';
import { hexToPixel } from '../utils/hexGrid.js';

const CELL_PX = 40;
const CELL_FT = 5;

function makeTokens(entries) {
  const map = new Map();
  for (const [id, { x, y }] of Object.entries(entries)) map.set(id, { x, y });
  return map;
}

describe('getTokensInCircle on hex grids', () => {
  it('hex_pointy: radius=2 cells (10ft) includes 2-step hex but not 3-step', () => {
    const origin = { x: 0, y: 0 };
    const inHex = hexToPixel({ q: 2, r: 0 }, { size: CELL_PX });
    const outHex = hexToPixel({ q: 3, r: 0 }, { size: CELL_PX });
    const tokens = makeTokens({
      a: { x: inHex.x, y: inHex.y },
      b: { x: outHex.x, y: outHex.y },
    });
    const ids = getTokensInCircle(tokens, origin, 2 * CELL_FT, CELL_PX, CELL_FT, { gridType: 'hex_pointy' });
    expect(ids).toEqual(['a']);
  });

  it('hex_pointy: a token diagonally 2 hex-steps away is included even though Euclidean is > 2 cells', () => {
    const origin = { x: 0, y: 0 };
    // q=1, r=1 → cube distance 2 (q=1, r=1, s=-2 → max=2)
    const corner = hexToPixel({ q: 1, r: 1 }, { size: CELL_PX });
    const tokens = makeTokens({ a: { x: corner.x, y: corner.y } });
    const ids = getTokensInCircle(tokens, origin, 2 * CELL_FT, CELL_PX, CELL_FT, { gridType: 'hex_pointy' });
    expect(ids).toEqual(['a']);
  });

  it('hex_flat orientation works the same way for +q neighbours', () => {
    const origin = { x: 0, y: 0 };
    const inHex = hexToPixel({ q: 1, r: 0 }, { size: CELL_PX, orientation: 'flat' });
    const tokens = makeTokens({ a: { x: inHex.x, y: inHex.y } });
    const ids = getTokensInCircle(tokens, origin, 1 * CELL_FT, CELL_PX, CELL_FT, { gridType: 'hex_flat' });
    expect(ids).toEqual(['a']);
  });

  it('square grid (no gridType / "square") falls back to Euclidean', () => {
    const origin = { x: 0, y: 0 };
    const tokens = makeTokens({
      a: { x: 1.5 * CELL_PX, y: 0 },           // 1.5 cells away - inside 2-cell radius
      b: { x: 2.5 * CELL_PX, y: 0 },           // 2.5 cells - outside
    });
    const ids = getTokensInCircle(tokens, origin, 2 * CELL_FT, CELL_PX, CELL_FT);
    expect(ids).toEqual(['a']);
  });

  it('square grid with explicit gridType behaves identically', () => {
    const origin = { x: 0, y: 0 };
    const tokens = makeTokens({ a: { x: 1.5 * CELL_PX, y: 0 } });
    const ids = getTokensInCircle(tokens, origin, 2 * CELL_FT, CELL_PX, CELL_FT, { gridType: 'square' });
    expect(ids).toEqual(['a']);
  });
});

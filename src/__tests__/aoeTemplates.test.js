/**
 * AoE template hit detection - getTokensInCircle / getTokensInCone
 *
 * Pure geometry functions that return which token IDs fall within
 * an area-of-effect template. All coordinates are in canvas pixels;
 * the caller converts feet → pixels using cellPx / cellFeet.
 */

import { describe, it, expect } from 'vitest';
import { getTokensInCircle, getTokensInCone } from '../utils/geometry.js';

// 5-foot grid cells, 40 px per cell
const CELL_PX = 40;
const CELL_FT = 5;

// Tokens are stored as { x, y } canvas-pixel positions (centre of token)
function makeTokens(entries) {
  return new Map(entries.map(([id, x, y]) => [id, { x, y }]));
}

describe('getTokensInCircle', () => {
  it('includes tokens whose centre is within the radius', () => {
    const tokens = makeTokens([['a', 200, 200], ['b', 240, 200]]);
    // Circle at (200,200) with 20 ft radius → 160 px
    const hit = getTokensInCircle(tokens, { x: 200, y: 200 }, 20, CELL_PX, CELL_FT);
    expect(hit).toContain('a');
    expect(hit).toContain('b');
  });

  it('excludes tokens outside the radius', () => {
    const tokens = makeTokens([['far', 500, 500]]);
    const hit = getTokensInCircle(tokens, { x: 200, y: 200 }, 20, CELL_PX, CELL_FT);
    expect(hit).not.toContain('far');
  });

  it('includes token exactly on the boundary', () => {
    // 20 ft = 160 px. Token at exactly 160 px away.
    const tokens = makeTokens([['edge', 360, 200]]);
    const hit = getTokensInCircle(tokens, { x: 200, y: 200 }, 20, CELL_PX, CELL_FT);
    expect(hit).toContain('edge');
  });

  it('returns empty array when no tokens are in range', () => {
    const tokens = makeTokens([['a', 800, 800]]);
    const hit = getTokensInCircle(tokens, { x: 0, y: 0 }, 5, CELL_PX, CELL_FT);
    expect(hit).toEqual([]);
  });
});

describe('getTokensInCone', () => {
  // Cone pointing right (direction 0 rad), 90° arc, 20 ft length
  // Origin at (200, 200), token must be within 160 px AND within ±45°
  it('includes tokens in front within the arc', () => {
    const tokens = makeTokens([['front', 320, 200]]); // straight ahead, 120 px
    const hit = getTokensInCone(tokens, { x: 200, y: 200 }, 0, 20, 90, CELL_PX, CELL_FT);
    expect(hit).toContain('front');
  });

  it('excludes tokens behind the origin', () => {
    const tokens = makeTokens([['behind', 80, 200]]); // behind the cone
    const hit = getTokensInCone(tokens, { x: 200, y: 200 }, 0, 20, 90, CELL_PX, CELL_FT);
    expect(hit).not.toContain('behind');
  });

  it('excludes tokens outside the arc angle', () => {
    const tokens = makeTokens([['side', 200, 0]]); // directly above, 90° off-axis
    const hit = getTokensInCone(tokens, { x: 200, y: 200 }, 0, 20, 90, CELL_PX, CELL_FT);
    expect(hit).not.toContain('side');
  });

  it('excludes tokens beyond the cone length', () => {
    const tokens = makeTokens([['far', 600, 200]]); // 400 px = 50 ft, beyond 20 ft
    const hit = getTokensInCone(tokens, { x: 200, y: 200 }, 0, 20, 90, CELL_PX, CELL_FT);
    expect(hit).not.toContain('far');
  });
});

describe('getTokensInCone - hex grid (Phase 5K cone-on-hex)', () => {
  it('counts a token at hex distance 6 as in range when cone direction matches', () => {
    const tokens = new Map([
      ['a', { col: 6, row: 0, size: 1 }],
    ]);
    const hit = getTokensInCone(tokens, { x: 0, y: 0 }, 0, 30, 90, CELL_PX, CELL_FT, { gridType: 'hex_pointy' });
    expect(hit).toContain('a');
  });

  it('rejects a token whose hex distance exceeds the radius', () => {
    // 12 cells away (60 ft) is well past the 30 ft cone, regardless of orientation.
    const tokens = new Map([
      ['a', { x: 20 * CELL_PX, y: 0, size: 1 }],
    ]);
    const hit = getTokensInCone(tokens, { x: 0, y: 0 }, 0, 30, 180, CELL_PX, CELL_FT, { gridType: 'hex_flat' });
    expect(hit).not.toContain('a');
  });

  it('preserves Euclidean behaviour when no gridType supplied', () => {
    const tokens = new Map([
      ['a', { x: 6 * CELL_PX, y: 0, size: 1 }],
    ]);
    const hit = getTokensInCone(tokens, { x: 0, y: 0 }, 0, 30, 90, CELL_PX, CELL_FT);
    expect(hit).toContain('a');
  });
});

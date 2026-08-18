/**
 * Pure hit-test helpers - phase 6.
 * No `mr` dependency; primitives only so subagents can call them
 * without a stage.
 */
import { describe, it, expect } from 'vitest';
import { tokenAt, wallAt, templateAt, strokeHitTest } from '../map/hit-test.js';

describe('tokenAt', () => {
  const tokens = new Map([['t1', { id: 't1', col: 3, row: 2, size: 1 }]]);
  const map = { cell_px: 40, width_cells: 10, height_cells: 10 };
  const getRadius = () => 15;

  it('finds a size-1 token at its grid centre', () => {
    const hit = tokenAt({ tokens, map, gridType: undefined, x: 140, y: 100, getRadius });
    expect(hit?.id).toBe('t1');
  });

  it('returns null when no tokens are within radius', () => {
    expect(tokenAt({ tokens, map, gridType: undefined, x: 0, y: 0, getRadius })).toBeNull();
  });
});

describe('wallAt', () => {
  it('hits a horizontal wall within the threshold', () => {
    const walls = new Map([['w1', { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } }]]);
    expect(wallAt({ walls, x: 50, y: 5, threshold: 8 })?.id).toBe('w1');
    expect(wallAt({ walls, x: 50, y: 20, threshold: 8 })).toBeNull();
  });
});

describe('templateAt', () => {
  it('hits a circle template at origin', () => {
    const templates = new Map([['tp1', {
      id: 'tp1', shape: 'circle', origin: { col: 1, row: 1 }, radius: 2,
    }]]);
    expect(templateAt({ templates, x: 40, y: 40, cellPx: 40 })?.id).toBe('tp1');
    expect(templateAt({ templates, x: 200, y: 200, cellPx: 40 })).toBeNull();
  });
});

describe('strokeHitTest', () => {
  it('hits a line stroke within threshold', () => {
    const s = { type: 'line', width: 3, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    expect(strokeHitTest(s, 50, 2)).toBe(true);
    expect(strokeHitTest(s, 50, 30)).toBe(false);
  });
});

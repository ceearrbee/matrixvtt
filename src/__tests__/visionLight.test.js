/**
 * vision-light pure helpers.
 *
 * Lights from the UVTT importer (or hand-placed) act as additional
 * vision origins for the fog mask. cellLitByAnyLight is the predicate
 * powering future "is this token visible by ambient light" checks; it
 * tests for both range and wall occlusion.
 */
import { describe, it, expect } from 'vitest';
import { cellLitByAnyLight, lightsAsVisionOrigins } from '../map/vision-light.js';

describe('cellLitByAnyLight', () => {
  it('returns true when point is within a light radius and no wall blocks LOS', () => {
    const lights = new Map([
      ['l1', { id: 'l1', x: 100, y: 100, radius_px: 50 }],
    ]);
    expect(cellLitByAnyLight({ x: 130, y: 110 }, lights, [])).toBe(true);
  });

  it('returns false when point is outside every light radius', () => {
    const lights = new Map([
      ['l1', { id: 'l1', x: 100, y: 100, radius_px: 30 }],
    ]);
    expect(cellLitByAnyLight({ x: 200, y: 200 }, lights, [])).toBe(false);
  });

  it('returns false when a sight-blocking wall sits between light and point', () => {
    const lights = new Map([
      ['l1', { id: 'l1', x: 0, y: 0, radius_px: 200 }],
    ]);
    const walls = [
      { p1: { x: 50, y: -50 }, p2: { x: 50, y: 50 }, blocks_sight: true },
    ];
    expect(cellLitByAnyLight({ x: 100, y: 0 }, lights, walls)).toBe(false);
  });

  it('ignores walls that do not block sight', () => {
    const lights = new Map([
      ['l1', { id: 'l1', x: 0, y: 0, radius_px: 200 }],
    ]);
    const walls = [
      { p1: { x: 50, y: -50 }, p2: { x: 50, y: 50 }, blocks_sight: false },
    ];
    expect(cellLitByAnyLight({ x: 100, y: 0 }, lights, walls)).toBe(true);
  });

  it('skips malformed lights (missing radius or coords)', () => {
    const lights = [
      { x: 0, y: 0 },
      { x: 100, y: 100, radius_px: 0 },
      { x: 100, y: 100, radius_px: 50 },
    ];
    expect(cellLitByAnyLight({ x: 110, y: 110 }, lights, [])).toBe(true);
    expect(cellLitByAnyLight({ x: 200, y: 200 }, lights, [])).toBe(false);
  });
});

describe('lightsAsVisionOrigins', () => {
  it('maps each valid light to an origin with bright=radius and dark=0', () => {
    const lights = new Map([
      ['l1', { id: 'l1', x: 10, y: 20, radius_px: 80 }],
      ['l2', { id: 'l2', x: 30, y: 40, radius_px: 50 }],
    ]);
    const origins = lightsAsVisionOrigins(lights);
    expect(origins).toEqual([
      { x: 10, y: 20, bright: 80, dark: 0 },
      { x: 30, y: 40, bright: 50, dark: 0 },
    ]);
  });

  it('drops malformed entries', () => {
    const lights = [
      null,
      { x: 0, y: 0 },
      { x: 1, y: 1, radius_px: 0 },
      { x: 2, y: 2, radius_px: 5 },
    ];
    expect(lightsAsVisionOrigins(lights)).toHaveLength(1);
  });

  it('returns [] for nullish input', () => {
    expect(lightsAsVisionOrigins(null)).toEqual([]);
    expect(lightsAsVisionOrigins(undefined)).toEqual([]);
  });
});

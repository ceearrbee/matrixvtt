/**
 * Parse Universal VTT (Dungeondraft / Arkenforge) files.
 * For now just extract walls from `line_of_sight` polylines. Each pair of
 * consecutive points in a polyline becomes a wall segment scaled by
 * resolution.pixels_per_grid so downstream code sees pixel coordinates.
 *
 * UVTT spec: https://arkenforge.com/universal-vtt-files/
 */

import { describe, it, expect } from 'vitest';
import { parseUVTT } from '../utils/uvttImport.js';

const sample = {
  format: 0.3,
  resolution: {
    map_origin: { x: 0, y: 0 },
    map_size: { x: 10, y: 10 },
    pixels_per_grid: 70,
  },
  line_of_sight: [
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ],
  ],
  portals: [],
  lights: [],
};

describe('parseUVTT', () => {
  it('returns empty walls for a file with no line_of_sight', () => {
    expect(parseUVTT({ resolution: { pixels_per_grid: 50 } }).walls).toEqual([]);
  });

  it('converts a polyline into N-1 wall segments', () => {
    const { walls } = parseUVTT(sample);
    expect(walls).toHaveLength(2);
  });

  it('scales coordinates by pixels_per_grid', () => {
    const { walls } = parseUVTT(sample);
    expect(walls[0].p1).toEqual({ x: 0, y: 0 });
    expect(walls[0].p2).toEqual({ x: 140, y: 0 });
    expect(walls[1].p1).toEqual({ x: 140, y: 0 });
    expect(walls[1].p2).toEqual({ x: 140, y: 140 });
  });

  it('walls block both sight and movement by default', () => {
    const { walls } = parseUVTT(sample);
    for (const w of walls) {
      expect(w.blocks_sight).toBe(true);
      expect(w.blocks_movement).toBe(true);
      expect(w.id).toMatch(/^uvtt-wall-/);
    }
  });

  it('handles multiple polylines and skips degenerate ones', () => {
    const out = parseUVTT({
      resolution: { pixels_per_grid: 1 },
      line_of_sight: [
        [{ x: 0, y: 0 }, { x: 5, y: 0 }],
        [{ x: 10, y: 10 }],     // single point - no segments
        [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }],
      ],
    });
    expect(out.walls).toHaveLength(3);
  });

  it('defaults pixels_per_grid to 1 when missing', () => {
    const out = parseUVTT({
      line_of_sight: [[{ x: 2, y: 3 }, { x: 4, y: 5 }]],
    });
    expect(out.walls[0].p1).toEqual({ x: 2, y: 3 });
    expect(out.walls[0].p2).toEqual({ x: 4, y: 5 });
  });

  it('emits open portals as non-blocking wall segments with is_portal flag', () => {
    const { walls } = parseUVTT({
      resolution: { pixels_per_grid: 10 },
      portals: [
        { closed: false, bounds: [{ x: 1, y: 1 }, { x: 3, y: 1 }] },
      ],
    });
    expect(walls).toHaveLength(1);
    const w = walls[0];
    expect(w.is_portal).toBe(true);
    expect(w.is_open).toBe(true);
    expect(w.blocks_sight).toBe(false);
    expect(w.blocks_movement).toBe(false);
    expect(w.p1).toEqual({ x: 10, y: 10 });
    expect(w.p2).toEqual({ x: 30, y: 10 });
    expect(w.id).toMatch(/^uvtt-portal-/);
  });

  it('emits closed portals as blocking wall segments', () => {
    const { walls } = parseUVTT({
      resolution: { pixels_per_grid: 10 },
      portals: [
        { closed: true, bounds: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      ],
    });
    expect(walls[0].is_portal).toBe(true);
    expect(walls[0].is_open).toBe(false);
    expect(walls[0].blocks_sight).toBe(true);
    expect(walls[0].blocks_movement).toBe(true);
  });

  it('skips portals with malformed bounds', () => {
    const { walls } = parseUVTT({
      resolution: { pixels_per_grid: 1 },
      portals: [
        { closed: false, bounds: [{ x: 0, y: 0 }] },
        { closed: false },
        null,
      ],
    });
    expect(walls).toHaveLength(0);
  });

  it('parses lights with scaled radius, color and intensity', () => {
    const { lights } = parseUVTT({
      resolution: { pixels_per_grid: 50 },
      lights: [
        { position: { x: 2, y: 3 }, range: 4, intensity: 0.8, color: 'ffaa00ff' },
      ],
    });
    expect(lights).toHaveLength(1);
    expect(lights[0]).toMatchObject({
      x: 100,
      y: 150,
      radius_px: 200,
      intensity: 0.8,
      color: 'ffaa00ff',
    });
    expect(lights[0].id).toMatch(/^uvtt-light-/);
  });

  it('returns empty lights array for a file with no lights', () => {
    expect(parseUVTT({ resolution: { pixels_per_grid: 50 } }).lights).toEqual([]);
  });

  it('skips malformed lights', () => {
    const { lights } = parseUVTT({
      resolution: { pixels_per_grid: 1 },
      lights: [
        null,
        { position: { x: 1, y: 1 } }, // missing range
        { range: 5 },                  // missing position
        { position: { x: 2, y: 2 }, range: 3 },
      ],
    });
    expect(lights).toHaveLength(1);
    expect(lights[0].x).toBe(2);
  });
});

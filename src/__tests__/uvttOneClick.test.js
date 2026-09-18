/**
 * A UVTT file carries the battlemap, its grid and its walls together.
 *
 * The parser read walls, portals and lights and threw away the
 * embedded image and the grid size, so importing a battlemap meant
 * importing the file, then finding and uploading the same map's image
 * by hand, then typing the cell size in. Everything needed was in the
 * file already.
 *
 * Wall coordinates are in grid units, so they scale by whatever cell
 * size the map ends up with. Scaling them by the file's raw
 * pixels-per-grid while the map clamps to a different cell size is how
 * walls end up floating off the grid.
 */

import { describe, it, expect } from 'vitest';
import { parseUVTT } from '../utils/uvttImport.js';
import { MAP_BOUNDS } from '../utils/schemas/world.js';

const file = (over = {}) => ({
  resolution: { map_size: { x: 30, y: 20 }, pixels_per_grid: 50 },
  line_of_sight: [[{ x: 0, y: 0 }, { x: 2, y: 0 }]],
  portals: [],
  lights: [],
  ...over,
});

describe('parseUVTT reads the grid', () => {
  it('reports the map size in cells', () => {
    const { grid } = parseUVTT(file());
    expect(grid.widthCells).toBe(30);
    expect(grid.heightCells).toBe(20);
  });

  it('reports the cell size from pixels per grid', () => {
    expect(parseUVTT(file()).grid.cellPx).toBe(50);
  });

  it('clamps a cell size the map schema would reject', () => {
    const { grid } = parseUVTT(file({ resolution: { map_size: { x: 4, y: 4 }, pixels_per_grid: 256 } }));
    expect(grid.cellPx).toBeLessThanOrEqual(MAP_BOUNDS.cellPx.max);
    expect(grid.cellPx).toBeGreaterThanOrEqual(MAP_BOUNDS.cellPx.min);
  });

  it('clamps a map larger than the schema allows', () => {
    const { grid } = parseUVTT(file({ resolution: { map_size: { x: 400, y: 9 }, pixels_per_grid: 50 } }));
    expect(grid.widthCells).toBeLessThanOrEqual(MAP_BOUNDS.cells.max);
  });

  it('says when it had to change the numbers', () => {
    expect(parseUVTT(file()).grid.clamped).toBe(false);
    expect(parseUVTT(file({ resolution: { map_size: { x: 4, y: 4 }, pixels_per_grid: 256 } })).grid.clamped).toBe(true);
  });
});

describe('walls land on the grid they are drawn for', () => {
  it('scales wall points by the cell size the map will use', () => {
    const { walls, grid } = parseUVTT(file());
    expect(grid.cellPx).toBe(50);
    expect(walls[0].p2.x).toBe(2 * 50);
  });

  it('scales by the clamped cell size, not the file’s raw value', () => {
    const parsed = parseUVTT(file({ resolution: { map_size: { x: 4, y: 4 }, pixels_per_grid: 256 } }));
    expect(parsed.walls[0].p2.x).toBe(2 * parsed.grid.cellPx);
  });

  it('honours an explicit cell size from the caller', () => {
    const parsed = parseUVTT(file(), { cellPx: 40 });
    expect(parsed.grid.cellPx).toBe(40);
    expect(parsed.walls[0].p2.x).toBe(2 * 40);
  });
});

describe('the embedded image comes through', () => {
  it('hands back the base64 image when the file carries one', () => {
    expect(parseUVTT(file({ image: 'aGVsbG8=' })).image).toBe('aGVsbG8=');
  });

  it('is null when the file carries none', () => {
    expect(parseUVTT(file()).image).toBeNull();
  });

  it('still parses a file with no resolution block at all', () => {
    const parsed = parseUVTT({ line_of_sight: [], portals: [], lights: [] });
    expect(parsed.walls).toEqual([]);
    expect(parsed.image).toBeNull();
    expect(parsed.grid).toBeNull();
  });
});

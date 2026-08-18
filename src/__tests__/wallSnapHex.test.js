/**
 * Walls snap to hex vertices on hex grids. On square grids
 * walls continue to snap to cell corners (Math.round(x / cell_px) *
 * cell_px). The hex variant picks the nearest of the six vertices of
 * the hex containing the click point.
 */
import { describe, it, expect } from 'vitest';
import { nearestHexVertex, hexToPixel } from '../utils/hexGrid.js';
import { buildWall } from '../map/input/tools.js';

const SIZE = 40;

function pointyVertices(center, size) {
  const angles = [30, 90, 150, 210, 270, 330].map((d) => (d * Math.PI) / 180);
  return angles.map((a) => ({ x: center.x + size * Math.cos(a), y: center.y + size * Math.sin(a) }));
}

function flatVertices(center, size) {
  const angles = [0, 60, 120, 180, 240, 300].map((d) => (d * Math.PI) / 180);
  return angles.map((a) => ({ x: center.x + size * Math.cos(a), y: center.y + size * Math.sin(a) }));
}

describe('nearestHexVertex', () => {
  it('snaps a click at a vertex to that exact vertex (pointy)', () => {
    const center = hexToPixel({ q: 0, r: 0 }, { size: SIZE });
    const verts = pointyVertices(center, SIZE);
    for (const v of verts) {
      const snapped = nearestHexVertex(v, { size: SIZE });
      expect(snapped.x).toBeCloseTo(v.x, 6);
      expect(snapped.y).toBeCloseTo(v.y, 6);
    }
  });

  it('snaps a click slightly off-vertex to the same vertex (pointy)', () => {
    const center = hexToPixel({ q: 0, r: 0 }, { size: SIZE });
    const v = pointyVertices(center, SIZE)[0]; // angle 30°
    const offset = { x: v.x + 2, y: v.y - 1 };
    const snapped = nearestHexVertex(offset, { size: SIZE });
    expect(snapped.x).toBeCloseTo(v.x, 6);
    expect(snapped.y).toBeCloseTo(v.y, 6);
  });

  it('snaps a click at the centre to one of the six vertices, not the centre', () => {
    const center = hexToPixel({ q: 0, r: 0 }, { size: SIZE });
    const snapped = nearestHexVertex(center, { size: SIZE });
    const dx = snapped.x - center.x;
    const dy = snapped.y - center.y;
    expect(Math.hypot(dx, dy)).toBeCloseTo(SIZE, 6);
  });

  it('flat orientation: snap matches the flat-vertex set', () => {
    const center = hexToPixel({ q: 0, r: 0 }, { size: SIZE, orientation: 'flat' });
    const verts = flatVertices(center, SIZE);
    for (const v of verts) {
      const snapped = nearestHexVertex(v, { size: SIZE, orientation: 'flat' });
      expect(snapped.x).toBeCloseTo(v.x, 6);
      expect(snapped.y).toBeCloseTo(v.y, 6);
    }
  });

  it('snaps a click in a neighbouring hex to the shared vertex', () => {
    // The +q neighbour of (0,0) is at axial (1,0) for pointy.
    // The vertex at angle 330° on (0,0) is shared with the neighbour.
    const center0 = hexToPixel({ q: 0, r: 0 }, { size: SIZE });
    const vShared = pointyVertices(center0, SIZE)[5]; // angle 330°
    // Tiny offset toward neighbour 0 - still snaps to the same vertex.
    const probe = { x: vShared.x + 0.5, y: vShared.y + 0.1 };
    const snapped = nearestHexVertex(probe, { size: SIZE });
    expect(Math.hypot(snapped.x - vShared.x, snapped.y - vShared.y)).toBeLessThan(2);
  });
});

describe('buildWall snaps hex grid endpoints to vertices', () => {
  function makeMr(gridType) {
    return { state: { map: { cell_px: SIZE }, settings: { grid_type: gridType } } };
  }

  it('square grid: snaps to integer cell corners (existing behaviour)', () => {
    const mr = makeMr('square');
    const wall = buildWall(mr, { x: 13, y: 21 }, { x: 79, y: 1 });
    expect(wall.p1).toEqual({ x: 0, y: SIZE });   // 13→0, 21→40
    expect(wall.p2).toEqual({ x: SIZE * 2, y: 0 }); // 79→80, 1→0
  });

  it('hex_pointy: snaps endpoints to a hex vertex', () => {
    const mr = makeMr('hex_pointy');
    const center = hexToPixel({ q: 0, r: 0 }, { size: SIZE });
    const v0 = pointyVertices(center, SIZE)[0];
    // Click slightly off the vertex
    const wall = buildWall(mr, { x: v0.x + 1, y: v0.y + 1 }, { x: v0.x + 200, y: v0.y + 200 });
    expect(wall.p1.x).toBeCloseTo(v0.x, 6);
    expect(wall.p1.y).toBeCloseTo(v0.y, 6);
  });

  it('hex_flat: snaps endpoints to the flat-vertex set', () => {
    const mr = makeMr('hex_flat');
    const center = hexToPixel({ q: 0, r: 0 }, { size: SIZE, orientation: 'flat' });
    const v0 = flatVertices(center, SIZE)[0];
    const wall = buildWall(mr, { x: v0.x - 1, y: v0.y + 1 }, { x: v0.x + 100, y: v0.y - 100 });
    expect(wall.p1.x).toBeCloseTo(v0.x, 6);
    expect(wall.p1.y).toBeCloseTo(v0.y, 6);
  });
});

/**
 * Bug regression: MapRenderer must initialize drawColor / drawWidth
 * so that the first stroke (before any user interaction with the
 * toolbar's color/width inputs) renders with valid attributes.
 *
 * Pre-fix, both fields were undefined until the user manually
 * fiddled with the toolbar's color picker / width select - which
 * meant the very first Line / Rect / Circle / Pencil stroke was
 * emitted as `{ color: undefined, width: undefined, … }` and Konva
 * drew it invisibly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildStroke } from '../map/input/tools.js';

const RENDERER_SRC = readFileSync(
  resolve(process.cwd(), 'src/map-renderer.js'),
  'utf8',
);

describe('MapRenderer draw defaults', () => {
  it('declares drawColor and drawWidth in MAP_RENDERER_DEFAULTS', async () => {
    // Pinned to the values the DrawToolbar paints in its markup
    // (`#ff4444` color, width "3"/Normal). If either default drifts
    // from the toolbar's, this test fails before the visual bug ships.
    expect(RENDERER_SRC).toMatch(/drawColor:\s*['"]#ff4444['"]/);
    expect(RENDERER_SRC).toMatch(/drawWidth:\s*3\b/);
    const { MAP_RENDERER_DEFAULTS } = await import('../map-renderer.js');
    expect(MAP_RENDERER_DEFAULTS.drawColor).toBe('#ff4444');
    expect(MAP_RENDERER_DEFAULTS.drawWidth).toBe(3);
  });

  it('buildStroke produces non-undefined color/width given the constructor defaults', () => {
    const mrLike = { activeTool: 'line', drawColor: '#ff4444', drawWidth: 3 };
    const s = buildStroke(mrLike, { x: 0, y: 0 }, { x: 10, y: 10 });
    expect(s.color).toBe('#ff4444');
    expect(s.width).toBe(3);
  });
});

/**
 * resolveBackgroundSource - the one place that decides what paints
 * under a map's image layers. Pure, so the Konva layer and the map form
 * can both ask without a DOM.
 */
import { describe, it, expect } from 'vitest';
import { resolveBackgroundSource } from '../map/background-source.js';

describe('resolveBackgroundSource', () => {
  it('paints the theme floor for a bare map', () => {
    expect(resolveBackgroundSource({ width_cells: 10, height_cells: 10 }))
      .toEqual({ fill: { kind: 'floor' }, layers: [] });
  });

  it('treats a missing map as a bare one', () => {
    expect(resolveBackgroundSource(null)).toEqual({ fill: { kind: 'floor' }, layers: [] });
  });

  it('normalises a legacy image_url into one base layer and no floor', () => {
    const { fill, layers } = resolveBackgroundSource({ image_url: 'mxc://hs/abc' });
    expect(fill).toEqual({ kind: 'none' });
    expect(layers).toEqual([{ id: 'base', image_url: 'mxc://hs/abc', visible: true, opacity: 1 }]);
  });

  it('prefers an explicit layer stack over image_url', () => {
    const layers = [{ id: 'l1', image_url: 'https://x/1.png', visible: true, opacity: 1 }];
    const out = resolveBackgroundSource({ image_url: 'mxc://hs/abc', layers });
    expect(out.layers).toEqual(layers);
  });

  it('resolves a tile fill and keeps the layers above it', () => {
    const layers = [{ id: 'l1', image_url: 'https://x/1.png', visible: true, opacity: 1 }];
    const out = resolveBackgroundSource({
      background: { kind: 'tile', tile: 'stone-floor', scale: 2 },
      layers,
    });
    expect(out.fill).toEqual({ kind: 'tile', tile: 'stone-floor', scale: 2 });
    expect(out.layers).toEqual(layers);
  });

  it('defaults a tile scale of 1 and clamps a silly one', () => {
    const at = (scale) => resolveBackgroundSource({ background: { kind: 'tile', tile: 't', scale } }).fill.scale;
    expect(at(undefined)).toBe(1);
    expect(at(0)).toBe(1);
    expect(at(-3)).toBe(1);
    expect(at(99)).toBe(8);
    expect(at('2')).toBe(1);
  });

  it('resolves a generated fill, defaulting the palette and style', () => {
    const { fill } = resolveBackgroundSource({
      background: { kind: 'generated', generator: 'dungeon', seed: 'a7f3c2' },
    });
    expect(fill).toEqual({
      kind: 'generated', generator: 'dungeon', seed: 'a7f3c2',
      palette: 'dungeon', style: 'textured', params: null,
    });
  });

  it('keeps an explicit palette, style and params', () => {
    const { fill } = resolveBackgroundSource({
      background: {
        kind: 'generated', generator: 'cave', seed: 'zz9',
        palette: 'frozen', style: 'lines', params: { fill: 40 },
      },
    });
    expect(fill).toMatchObject({ palette: 'frozen', style: 'lines', params: { fill: 40 } });
  });

  it('keeps layers above a generated fill', () => {
    const layers = [{ id: 'l1', image_url: 'https://x/1.png', visible: true, opacity: 1 }];
    const out = resolveBackgroundSource({
      background: { kind: 'generated', generator: 'dungeon', seed: 'a1' },
      layers,
    });
    expect(out.fill.kind).toBe('generated');
    expect(out.layers).toEqual(layers);
  });

  it('rejects a seed that is not a seed, and an unusable style', () => {
    const floor = { kind: 'floor' };
    const bad = (bg) => resolveBackgroundSource({ background: bg }).fill;
    expect(bad({ kind: 'generated', generator: 'dungeon', seed: 'has spaces' })).toEqual(floor);
    expect(bad({ kind: 'generated', generator: 'dungeon', seed: 'x'.repeat(40) })).toEqual(floor);
    expect(bad({ kind: 'generated', generator: 'dungeon' })).toEqual(floor);
    expect(bad({ kind: 'generated', seed: 'a1' })).toEqual(floor);
  });

  it('falls back to a known style rather than passing a junk one to the painter', () => {
    const { fill } = resolveBackgroundSource({
      background: { kind: 'generated', generator: 'dungeon', seed: 'a1', style: 'neon' },
    });
    expect(fill.style).toBe('textured');
  });

  // A peer on a newer build can write a background kind this one has never
  // heard of. Degrade to the floor rather than throwing, the same way
  // resolveGroup tolerates unknown play-action sources.
  it('degrades an unknown or malformed background to the floor', () => {
    const floor = { kind: 'floor' };
    expect(resolveBackgroundSource({ background: { kind: 'hologram' } }).fill).toEqual(floor);
    expect(resolveBackgroundSource({ background: { kind: 'tile' } }).fill).toEqual(floor);
    expect(resolveBackgroundSource({ background: { kind: 'tile', tile: '' } }).fill).toEqual(floor);
    expect(resolveBackgroundSource({ background: 'stone' }).fill).toEqual(floor);
  });

  it('drops layers with no image and hides nothing else', () => {
    const out = resolveBackgroundSource({
      layers: [
        { id: 'a', image_url: 'https://x/1.png', visible: true, opacity: 1 },
        { id: 'b', image_url: '', visible: true, opacity: 1 },
      ],
    });
    expect(out.layers.map((l) => l.id)).toEqual(['a']);
  });
});

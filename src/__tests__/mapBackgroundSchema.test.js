/**
 * The map schema has to accept a `background` descriptor and reject a
 * malformed one, because it gates the snapshot load path on join.
 *
 * It is deliberately permissive about the `kind` itself: a peer on a
 * newer build can write a kind this one has never heard of, and losing
 * the whole map over it would be worse than painting the theme floor,
 * which is what resolveBackgroundSource does with it. Shape is enforced
 * for the kinds we do know.
 */
import { describe, it, expect } from 'vitest';
import { validateMap } from '../utils/schemas/world.js';

const base = { width_cells: 10, height_cells: 10, cell_px: 40 };

describe('validateMap background', () => {
  it('accepts a map with no background at all', () => {
    expect(validateMap(base)).toBe(true);
  });

  it('accepts a tile background, with or without a scale', () => {
    expect(validateMap({ ...base, background: { kind: 'tile', tile: 'stone-floor', scale: 2 } })).toBe(true);
    expect(validateMap({ ...base, background: { kind: 'tile', tile: 'stone-floor' } })).toBe(true);
  });

  it('accepts a null background', () => {
    expect(validateMap({ ...base, background: null })).toBe(true);
  });

  it('accepts a kind from a newer build rather than dropping the map', () => {
    expect(validateMap({ ...base, background: { kind: 'hologram', mood: 'blue' } })).toBe(true);
  });

  it('rejects a background that is not an object', () => {
    expect(() => validateMap({ ...base, background: 'stone' })).toThrow(/background/i);
  });

  it('rejects a background with no kind, which is corruption not a newer build', () => {
    expect(() => validateMap({ ...base, background: { tile: 'stone-floor' } })).toThrow(/background/i);
  });

  it('accepts a generated background', () => {
    expect(validateMap({ ...base, background: { kind: 'generated', generator: 'dungeon', seed: 'a7f3c2' } })).toBe(true);
    expect(validateMap({
      ...base,
      background: { kind: 'generated', generator: 'cave', seed: 'zz9', palette: 'frozen', style: 'lines', params: { fill: 40 } },
    })).toBe(true);
  });

  it('rejects a generated background missing its generator or seed', () => {
    expect(() => validateMap({ ...base, background: { kind: 'generated', seed: 'a1' } })).toThrow(/background/i);
    expect(() => validateMap({ ...base, background: { kind: 'generated', generator: 'dungeon' } })).toThrow(/background/i);
  });

  it('rejects a tile background with no tile slug', () => {
    expect(() => validateMap({ ...base, background: { kind: 'tile' } })).toThrow(/background/i);
    expect(() => validateMap({ ...base, background: { kind: 'tile', tile: 42 } })).toThrow(/background/i);
  });
});

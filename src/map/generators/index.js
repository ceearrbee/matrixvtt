/**
 * Registry of map generators, and the one entry point the renderer and
 * the picker call.
 *
 * `generateTerrain` is the trust boundary. A `background` descriptor can
 * arrive from a peer on a newer build or a hand-edited import, so an
 * unknown generator, an unusable seed or an out-of-range size returns
 * null and the caller falls back to the plain floor.
 */

import { MAP_BOUNDS } from '../../utils/schemas/world.js';
import { makeRng, SEED_PATTERN } from './rng.js';
import { generateDungeon } from './dungeon.js';
import { generateCave } from './cave.js';

export const GENERATORS = Object.freeze({
  dungeon: Object.freeze({
    id: 'dungeon',
    label: 'Dungeon',
    description: 'Rectangular chambers joined by corridors.',
    defaults: Object.freeze({ roomAttempts: 60, roomMin: 3, roomMax: 8, corridorWidth: 1, rubble: 12 }),
    params: Object.freeze([
      { key: 'roomAttempts', label: 'Rooms', min: 4, max: 200 },
      { key: 'roomMin', label: 'Smallest room', min: 2, max: 10 },
      { key: 'roomMax', label: 'Largest room', min: 3, max: 16 },
      { key: 'corridorWidth', label: 'Corridor width', min: 1, max: 3 },
      { key: 'rubble', label: 'Rubble', min: 0, max: 60 },
    ]),
    generate: generateDungeon,
  }),
  cave: Object.freeze({
    id: 'cave',
    label: 'Cavern',
    description: 'Natural chambers smoothed out of noise.',
    defaults: Object.freeze({ fill: 45, smoothing: 4, water: 6 }),
    params: Object.freeze([
      { key: 'fill', label: 'Rock', min: 30, max: 60 },
      { key: 'smoothing', label: 'Smoothing', min: 1, max: 8 },
      { key: 'water', label: 'Pools', min: 0, max: 30 },
    ]),
    generate: generateCave,
  }),
});

/**
 * @param {{generator: string, seed: string, width: number, height: number, params?: object}} spec
 * @returns {{width: number, height: number, cells: Uint8Array}|null}
 */
export function generateTerrain(spec) {
  const generator = GENERATORS[spec?.generator];
  if (!generator) return null;
  if (typeof spec.seed !== 'string' || !SEED_PATTERN.test(spec.seed)) return null;

  const { width, height } = spec;
  if (!inBounds(width) || !inBounds(height)) return null;

  return generator.generate({
    rng: makeRng(`${spec.generator}:${spec.seed}`),
    width,
    height,
    params: clampParams(generator, spec.params),
  });
}

function inBounds(n) {
  return Number.isInteger(n) && n >= MAP_BOUNDS.cells.min && n <= MAP_BOUNDS.cells.max;
}

/** Declared ranges are the contract; anything outside them is clamped, not honoured. */
function clampParams(generator, params) {
  const out = { ...generator.defaults };
  for (const { key, min, max } of generator.params) {
    const value = Number(params?.[key]);
    if (!Number.isFinite(value)) continue;
    out[key] = Math.min(max, Math.max(min, Math.round(value)));
  }
  return out;
}

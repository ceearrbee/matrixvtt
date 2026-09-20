/**
 * Seeded pseudo-random numbers for the map generators.
 *
 * A generated map stores its seed, not its pixels, so every client has
 * to reproduce the same sequence from the same short string. That rules
 * out Math.random and rules in a small, stable, explicit generator.
 */

const SEED_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SEED_LENGTH = 6;

/** What counts as a seed anywhere it crosses a trust boundary. */
export const SEED_PATTERN = /^[a-z0-9-]{1,32}$/;

/** FNV-1a over the seed string. Stable across runs and engines. */
export function seedToInt(seed) {
  const text = String(seed ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32. Returns a function producing numbers in [0, 1). */
export function makeRng(seed) {
  let state = seedToInt(seed);
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A short slug a GM can read out at the table and someone else retype. */
export function randomSeed(rng = Math.random) {
  let out = '';
  for (let i = 0; i < SEED_LENGTH; i += 1) {
    out += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
  }
  return out;
}

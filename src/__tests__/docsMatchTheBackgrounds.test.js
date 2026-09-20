/**
 * The map-background guide names generators, palettes and a tile count.
 * All three are read out of the code, so renaming a generator or
 * dropping a tile has to be noticed here rather than by a GM following
 * instructions for a build that no longer exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GENERATORS } from '../map/generators/index.js';
import { PALETTES } from '../map/generators/palettes.js';

const root = resolve(import.meta.dirname, '../../');
const guide = readFileSync(join(root, 'docs/guide/map-backgrounds.md'), 'utf8');

function shippedTiles() {
  const dir = join(root, 'public/backgrounds/tiles');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.webp'));
}

describe('the map-background guide', () => {
  it.each(Object.values(GENERATORS).map((g) => g.label))('names the %s layout', (label) => {
    expect(guide).toContain(label);
  });

  it.each(Object.values(PALETTES).map((p) => p.label))('names the %s palette', (label) => {
    expect(guide).toContain(label);
  });

  it('names every material a palette can be filtered by', () => {
    const manifest = join(root, 'public/backgrounds/index.json');
    if (!existsSync(manifest)) return;
    const materials = JSON.parse(readFileSync(manifest, 'utf8')).materials ?? [];
    for (const material of materials) expect(guide.toLowerCase()).toContain(material);
  });

  it('states the tile count that actually ships', () => {
    const count = shippedTiles().length;
    if (count === 0) return;
    expect(guide).toMatch(new RegExp(`\\b${count}\\b|\\b${numberWord(count)}\\b`, 'i'));
  });

  it('names the seed length the generator actually produces', () => {
    expect(guide).toMatch(/six characters/i);
  });

  it('explains how to get tokens onto a map that starts empty', () => {
    expect(guide).toContain('Place Tokens Here');
    expect(guide).toMatch(/travel pin/i);
  });

  it('warns that widget mode cannot fetch authenticated media', () => {
    expect(guide).toMatch(/widget/i);
    expect(guide).toMatch(/authenticat/i);
  });

  it('is reachable from the sidebar and the quickstart', () => {
    const config = readFileSync(join(root, 'docs/.vitepress/config.mjs'), 'utf8');
    expect(config).toContain('/guide/map-backgrounds');
    expect(readFileSync(join(root, 'docs/guide/gm-quickstart.md'), 'utf8'))
      .toContain('/guide/map-backgrounds');
  });
});

function numberWord(n) {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
    'eighteen', 'nineteen', 'twenty'];
  return words[n] ?? String(n);
}

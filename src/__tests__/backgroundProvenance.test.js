/**
 * Provenance gate for the bundled terrain tiles.
 *
 * Every shipped tile must carry a licence row naming where it came
 * from. This is the test that makes "with the appropriate license" a
 * build failure rather than a promise, so it reads the real directory
 * and the real sources.json, not a fixture.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildBackgroundManifest, ALLOWED_LICENSES } from '../../scripts/backgrounds-manifest.mjs';

const ROOT = join(process.cwd(), 'public', 'backgrounds');
const TILES = join(ROOT, 'tiles');

function readSources() {
  const p = join(ROOT, 'sources.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { version: 1, tiles: [] };
}

function tileFiles() {
  if (!existsSync(TILES)) return [];
  return readdirSync(TILES).filter((f) => f.endsWith('.webp'))
    .map((file) => ({ file, bytes: statSync(join(TILES, file)).size }));
}

describe('bundled terrain tile provenance', () => {
  it('every shipped tile has a licence row, and every row has a file', () => {
    const { errors } = buildBackgroundManifest(readSources(), tileFiles());
    expect(errors).toEqual([]);
  });

  it('accepts only public-domain-equivalent licences', () => {
    for (const row of readSources().tiles ?? []) {
      expect(ALLOWED_LICENSES).toContain(row.license);
    }
  });

  it('names a real source URL and author for each row', () => {
    for (const row of readSources().tiles ?? []) {
      expect(row.author, `${row.id} author`).toBeTruthy();
      expect(row.source_url, `${row.id} source_url`).toMatch(/^https:\/\//);
      expect(row.retrieved, `${row.id} retrieved`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('buildBackgroundManifest', () => {
  const row = {
    id: 'stone-floor', file: 'stone-floor.webp', label: 'Stone floor', material: 'stone',
    title: 'Rock030', author: 'ambientCG', source_url: 'https://ambientcg.com/view?id=Rock030',
    license: 'CC0-1.0', retrieved: '2026-09-18',
  };
  const file = { file: 'stone-floor.webp', bytes: 30000 };

  it('emits a manifest entry and a licence block for a good row', () => {
    const { manifest, licenseText, errors } = buildBackgroundManifest({ version: 1, tiles: [row] }, [file]);
    expect(errors).toEqual([]);
    expect(manifest.tiles).toEqual([{
      id: 'stone-floor', file: 'stone-floor.webp', label: 'Stone floor', material: 'stone',
      title: 'Rock030', author: 'ambientCG', source_url: 'https://ambientcg.com/view?id=Rock030',
      license: 'CC0-1.0',
    }]);
    expect(manifest.materials).toEqual(['stone']);
    expect(licenseText).toContain('ambientCG');
    expect(licenseText).toContain('CC0-1.0');
  });

  it('is green on an empty pack so a fresh clone still builds', () => {
    const { manifest, errors } = buildBackgroundManifest({ version: 1, tiles: [] }, []);
    expect(errors).toEqual([]);
    expect(manifest.tiles).toEqual([]);
  });

  it('reports a shipped file with no licence row', () => {
    const { errors } = buildBackgroundManifest({ version: 1, tiles: [] }, [file]);
    expect(errors.join(' ')).toMatch(/stone-floor\.webp/);
  });

  it('reports a row whose file is missing', () => {
    const { errors } = buildBackgroundManifest({ version: 1, tiles: [row] }, []);
    expect(errors.join(' ')).toMatch(/stone-floor\.webp/);
  });

  it('reports a licence outside the allowlist', () => {
    const bad = { ...row, license: 'CC-BY-NC-4.0' };
    const { errors } = buildBackgroundManifest({ version: 1, tiles: [bad] }, [file]);
    expect(errors.join(' ')).toMatch(/CC-BY-NC-4\.0/);
  });

  it('reports a missing required field', () => {
    for (const key of ['id', 'label', 'material', 'author', 'source_url', 'retrieved']) {
      const bad = { ...row };
      delete bad[key];
      const { errors } = buildBackgroundManifest({ version: 1, tiles: [bad] }, [file]);
      expect(errors.join(' '), key).toMatch(new RegExp(key));
    }
  });

  it('reports a duplicate id and a non-slug id', () => {
    expect(buildBackgroundManifest({ tiles: [row, row] }, [file]).errors.join(' ')).toMatch(/duplicate/i);
    const bad = { ...row, id: 'Stone Floor!' };
    expect(buildBackgroundManifest({ tiles: [bad] }, [file]).errors.join(' ')).toMatch(/slug/i);
  });

  it('reports a tile over the per-file byte cap and a pack over the total', () => {
    const fat = { file: 'stone-floor.webp', bytes: 400_000 };
    expect(buildBackgroundManifest({ tiles: [row] }, [fat]).errors.join(' ')).toMatch(/too large/i);

    const many = Array.from({ length: 40 }, (_, i) => ({ ...row, id: `t${i}`, file: `t${i}.webp` }));
    const manyFiles = many.map((r) => ({ file: r.file, bytes: 90_000 }));
    expect(buildBackgroundManifest({ tiles: many }, manyFiles).errors.join(' ')).toMatch(/pack budget/i);
  });
});

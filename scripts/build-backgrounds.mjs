#!/usr/bin/env node
/**
 * build-backgrounds.mjs - validates the bundled terrain tiles against
 * their licence rows and generates the picker manifest at
 * `public/backgrounds/index.json` plus the shipped credit file at
 * `public/backgrounds/LICENSE.txt`.
 *
 * The tiles and `sources.json` are committed; these two outputs are
 * derived and gitignored. Unlike the icon pack there is nothing to
 * extract - 700 KB of WebP is small enough to review in a diff, which
 * is the whole point when provenance is the requirement.
 *
 * Exits non-zero if a tile ships without a licence row, or a row names
 * a licence outside the allowlist. An empty pack is not an error, so a
 * fresh clone builds before anyone has added art.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBackgroundManifest } from './backgrounds-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'backgrounds');
const TILES = join(OUT, 'tiles');
const SOURCES = join(OUT, 'sources.json');
const MANIFEST = join(OUT, 'index.json');
const LICENSE = join(OUT, 'LICENSE.txt');

function ok(msg) { process.stdout.write(`✓ ${msg}\n`); }
function die(msg) { process.stderr.write(`✗ ${msg}\n`); process.exit(1); }

function shouldSkip() {
  if (process.argv.includes('--force')) return false;
  if (!existsSync(MANIFEST)) return false;
  if (!existsSync(SOURCES)) return true;
  return statSync(MANIFEST).mtimeMs >= newestInputMs();
}

function newestInputMs() {
  let newest = statSync(SOURCES).mtimeMs;
  for (const f of tileFiles()) {
    newest = Math.max(newest, statSync(join(TILES, f.file)).mtimeMs);
  }
  return newest;
}

function tileFiles() {
  if (!existsSync(TILES)) return [];
  return readdirSync(TILES)
    .filter((f) => f.endsWith('.webp'))
    .sort()
    .map((file) => ({ file, bytes: statSync(join(TILES, file)).size }));
}

function readSources() {
  if (!existsSync(SOURCES)) return { version: 1, tiles: [] };
  try {
    return JSON.parse(readFileSync(SOURCES, 'utf8'));
  } catch (err) {
    die(`public/backgrounds/sources.json is not valid JSON: ${err.message}`);
  }
}

if (shouldSkip()) {
  ok('backgrounds: manifest up to date');
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const files = tileFiles();
const { manifest, licenseText, errors } = buildBackgroundManifest(readSources(), files);

if (errors.length > 0) {
  for (const e of errors) process.stderr.write(`  ${e}\n`);
  die(`backgrounds: ${errors.length} provenance problem(s). Every tile needs a row in public/backgrounds/sources.json.`);
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest)}\n`);
writeFileSync(LICENSE, licenseText);
ok(`backgrounds: ${files.length} tile(s), manifest + LICENSE.txt written`);

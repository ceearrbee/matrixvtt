/**
 * build-pwa-icons.mjs - raster app icons for the web app manifest.
 *
 * Separate from build-icons.mjs, which is 250 lines about unzipping
 * the game-icons.net token picker and shares nothing with this.
 *
 * Android launchers and the install prompt want PNGs; the manifest
 * shipped one SVG. It also claimed `purpose: "any maskable"` on
 * artwork with an rx=80 rounded rect, so the corners are transparent
 * and a maskable consumer crops into the die. A maskable icon has to
 * be opaque edge to edge with its artwork inside the centre 80%, so it
 * is generated as its own file rather than claimed of the SVG.
 *
 * Failure is fatal. A manifest entry pointing at a missing PNG is a
 * 404 on every install, which is worse than a failed build.
 */

import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public', 'icon.svg');
const BACKGROUND = '#16191f';

/** 10% padding a side is what the maskable safe zone asks for. */
const MASKABLE_SIZE = 512;
const MASKABLE_ART = Math.round(MASKABLE_SIZE * 0.8);

const OUTPUTS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: MASKABLE_SIZE, maskable: true },
];

const force = process.argv.includes('--force');
const ok = (m) => console.log(`  ✓ ${m}`);
const die = (m) => { console.error(`  ✗ ${m}`); process.exit(1); };

function upToDate() {
  if (force || !existsSync(SOURCE)) return false;
  const src = statSync(SOURCE).mtimeMs;
  return OUTPUTS.every(({ file }) => {
    const out = path.join(ROOT, 'public', file);
    return existsSync(out) && statSync(out).mtimeMs >= src;
  });
}

async function render(svg, { file, size, maskable }) {
  const out = path.join(ROOT, 'public', file);
  const image = maskable
    ? sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
      .composite([{
        input: await sharp(svg).resize(MASKABLE_ART, MASKABLE_ART).png().toBuffer(),
        top: Math.round((size - MASKABLE_ART) / 2),
        left: Math.round((size - MASKABLE_ART) / 2),
      }])
      .flatten({ background: BACKGROUND })
    : sharp(svg).resize(size, size);

  await image.png().toFile(out);

  const meta = await sharp(out).metadata();
  if (meta.width !== size || meta.height !== size) {
    die(`${file} rendered ${meta.width}x${meta.height}, expected ${size}x${size}`);
  }
  // A flat render means the SVG produced nothing; entropy catches it
  // where a size check cannot.
  const { entropy } = await sharp(out).stats();
  if (!(entropy > 1)) die(`${file} rendered nearly blank (entropy ${entropy})`);
  ok(`${file} ${size}x${size}`);
}

async function main() {
  if (!existsSync(SOURCE)) die(`missing ${path.relative(ROOT, SOURCE)}`);
  if (upToDate()) { console.log('  · pwa icons up to date'); return; }

  const svg = await readFile(SOURCE);
  for (const target of OUTPUTS) {
    try {
      await render(svg, target);
    } catch (err) {
      die(`${target.file}: ${err.message}`);
    }
  }
}

main();

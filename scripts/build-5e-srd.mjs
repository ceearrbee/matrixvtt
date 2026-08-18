/**
 * Regenerates src/content/compendium/dnd5e/ from the SRD 5.1 dataset
 * published by 5e-bits/5e-database (content license CC-BY-4.0).
 *
 * Usage:
 *   node scripts/build-5e-srd.mjs             # fetch pinned upstream revision
 *   node scripts/build-5e-srd.mjs --from DIR  # use pre-downloaded srd-*.json files
 *
 * Dev-time only. The generated JSON is committed; the app never runs this.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  transformSpell,
  transformMonster,
  transformEquipment,
  transformMagicItem,
} from './srd5e-transform.mjs';

const UPSTREAM_REPO = '5e-bits/5e-database';
const UPSTREAM_SHA = 'd18533d07353dd81784b176b88d067ba64e74437';
const OUT_DIR = new URL('../src/content/compendium/dnd5e/', import.meta.url).pathname;

const ATTRIBUTION =
  'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") ' +
  'by Wizards of the Coast LLC and available at ' +
  'https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed ' +
  'under the Creative Commons Attribution 4.0 International License available at ' +
  'https://creativecommons.org/licenses/by/4.0/legalcode.';

const SOURCES = {
  Spells: 'srd-Spells.json',
  Monsters: 'srd-Monsters.json',
  Equipment: 'srd-Equipment.json',
  'Magic-Items': 'srd-Magic-Items.json',
};

async function loadDataset(name, fromDir) {
  if (fromDir) {
    return JSON.parse(await readFile(join(fromDir, SOURCES[name]), 'utf8'));
  }
  const url = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_SHA}/src/2014/en/5e-SRD-${name}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

function fileMeta(kind) {
  return {
    system: 'dnd5e',
    kind,
    license: 'CC-BY-4.0',
    attribution: ATTRIBUTION,
    source_dataset: { repo: UPSTREAM_REPO, revision: UPSTREAM_SHA },
    generated_by: 'scripts/build-5e-srd.mjs',
  };
}

async function writeCompendiumFile(name, kind, entries) {
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const path = join(OUT_DIR, name);
  await writeFile(path, `${JSON.stringify({ meta: fileMeta(kind), entries }, null, 1)}\n`);
  console.log(`${path}: ${entries.length} entries`);
}

const fromFlag = process.argv.indexOf('--from');
const fromDir = fromFlag !== -1 ? process.argv[fromFlag + 1] : null;

const [spells, monsters, equipment, magicItems] = await Promise.all(
  Object.keys(SOURCES).map((name) => loadDataset(name, fromDir))
);

await mkdir(OUT_DIR, { recursive: true });
await writeCompendiumFile('spells.json', 'spells', spells.map(transformSpell));
await writeCompendiumFile('monsters.json', 'monsters', monsters.map(transformMonster));
await writeCompendiumFile(
  'items.json',
  'items',
  [...equipment.map(transformEquipment), ...magicItems.map(transformMagicItem)].filter(Boolean)
);

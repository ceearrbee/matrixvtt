#!/usr/bin/env node
/**
 * generate-examples.mjs
 *
 * Builds the example files the docs site embeds (rulesets, blank campaign)
 * from the live source. Run before every docs build so the examples can
 * never drift from the code they document.
 *
 * Inputs:
 *   src/state/rulesets.js      - every built-in game system preset
 *   src/state/campaign-init.js - initBlankCampaign
 *   src/ui/import-export.js    - exportCampaign
 *
 * Outputs (written to docs/examples/):
 *   dnd5e-ruleset.json, pathfinder-ruleset.json, fate-ruleset.json, custom-ruleset.json
 *   blank-campaign.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getGameSystemPresets } from '../../src/state/rulesets.js';
import { initBlankCampaign } from '../../src/state/campaign-init.js';
import { exportCampaign } from '../../src/state/campaign-sync.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'examples');
mkdirSync(outDir, { recursive: true });

// ─── StateManager shim ───────────────────────────────────────────────────────
// Only the fields touched by initBlankCampaign + exportCampaign - kept tiny
// so we don't have to stand up the whole sync/widget stack just to render docs.

import { fogSignal } from '../../src/state/signals.js';

function makeShim() {
  const characters = new Map();
  const npcs = new Map();
  const tokens = new Map();
  const items = new Map();
  const spells = new Map();
  const handouts = new Map();
  const tables = new Map();
  const pins = new Map();
  const templates = new Map();
  const walls = new Map();
  const maps = new Map();
  
  const sm = {
    widgetManager: { userId: '@gm:example.org' },
    tokens, characters, npcs, items, spells, handouts, tables, pins, templates, walls, maps,
    settings: {},
    activeMapId: null,
    fog: { mode: 'hidden', revealed: [] },
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    drawings: [],
    damageLog: [],
    roomMembers: [],
    processedEvents: new Set(),
    lastSentState: new Map(),
    _retryQueue: new Map(),
    _drainTimer: null,
    _debounceTimers: new Map(),
    _drawingHistory: [],
    _drawingFuture: [],
    _cleaningUp: false,
    _localSessionId: null,
    yjs: {
      doc: { transact: (fn) => fn() },
      mapsMap: maps, charactersMap: characters, npcsMap: npcs,
      tokensMap: tokens, itemsMap: items, spellsMap: spells, handoutsMap: handouts,
      pagesMap: new Map(), tablesMap: tables, wallsMap: walls, lightsMap: new Map(),
      pinsMap: pins, templatesMap: templates,
      settingsMap: { set: (k, v) => { sm.settings = v; sm.activeMapId = v.active_map_id; } },
      fogMap: { set: (k, v) => { fogSignal.value.set(k, v); } },
      initiativeMap: { set: (k, v) => { sm.initiative = v; } },
      drawingsArray: { push: (v) => { sm.drawings = Array.isArray(v[0]) ? v[0] : v; } },
    },
    _clearAllState() {
      this.tokens.clear(); this.characters.clear(); this.npcs.clear();
      this.items.clear(); this.spells.clear(); this.handouts.clear();
      this.tables.clear(); this.pins.clear(); this.templates.clear();
      this.walls.clear(); this.maps.clear();
      this.drawings = []; this.damageLog = []; this.roomMembers = [];
      this.activeMapId = null;
      fogSignal.value = new Map();
    },
  };
  return sm;
}

function write(filename, content) {
  const path = resolve(outDir, filename);
  writeFileSync(path, content);
  console.log(`  wrote ${path.replace(process.cwd() + '/', '')}`);
}

async function withDeterministicRuntime(seed, fn) {
  const originalNow = Date.now;
  const originalRandomUUID = globalThis.crypto?.randomUUID;
  let seq = 0;
  Date.now = () => seed;
  if (globalThis.crypto && originalRandomUUID) {
    globalThis.crypto.randomUUID = () => {
      seq += 1;
      return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
    };
  }
  try {
    return await fn();
  } finally {
    Date.now = originalNow;
    if (globalThis.crypto && originalRandomUUID) {
      globalThis.crypto.randomUUID = originalRandomUUID;
    }
  }
}

// ─── 1. Ruleset examples (one per built-in preset) ───────────────────────────

console.log('Generating ruleset examples...');
const presets = getGameSystemPresets();
for (const [key, preset] of Object.entries(presets)) {
  const payload = {
    vtt_export_type: 'ruleset',
    vtt_version: 1,
    system: key,
    ...preset,
  };
  write(`${key}-ruleset.json`, JSON.stringify(payload, null, 2) + '\n');
}

// ─── 2. Blank campaign archive ───────────────────────────────────────────────

console.log('Generating blank-campaign example...');
{
  const state = makeShim();
  await withDeterministicRuntime(0, () => initBlankCampaign(state, 'Example Campaign', 'dnd5e'));
  const archive = exportCampaign(state);
  archive.exported_at = 0; // deterministic
  write('blank-campaign.json', JSON.stringify(archive, null, 2) + '\n');
}

console.log('\nDone.');

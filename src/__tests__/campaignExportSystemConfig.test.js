/**
 * K1: campaign archives must carry the full inline systemConfig.
 *
 * If an archive only stored the `system` slug, rooms built on a retired
 * preset (like the old `pathfinder` / `savageworlds` slugs) would load
 * with a null ruleset when re-imported. This test locks the export's
 * inline-systemConfig behaviour in place.
 */

import { describe, it, expect } from 'vitest';
import { exportCampaign, importCampaign } from '../ui/import-export.js';

function mockMap() {
  const m = new Map();
  m.replace = (next) => { m.clear(); for (const [k, v] of next) m.set(k, v); };
  return m;
}

function blankState() {
  return {
    settings: { name: 'Test Room', gm_user_ids: [], grid_px: 40 },
    maps: mockMap(),
    tokens: mockMap(),
    characters: mockMap(),
    npcs: mockMap(),
    items: mockMap(),
    spells: mockMap(),
    handouts: mockMap(),
    tables: mockMap(),
    pins: mockMap(),
    walls: mockMap(),
    templates: mockMap(),
    fog: { mode: 'hidden', revealed: [] },
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    drawings: [],
    activeMapId: null,
  };
}

describe('exportCampaign - systemConfig bundling', () => {
  it('archive.settings includes the full inline systemConfig', () => {
    const homebrew = {
      meta: { name: 'My Homebrew', spec_version: '1.0' },
      attributes: [{ key: 'a', label: 'A' }],
      dice: { check: '1d20' },
    };
    const state = blankState();
    state.settings.system = 'homebrew';
    state.settings.systemConfig = homebrew;

    const archive = exportCampaign(state);

    expect(archive.settings.system).toBe('homebrew');
    expect(archive.settings.systemConfig).toEqual(homebrew);
  });

  it('round-trip: export → import preserves systemConfig byte-for-byte', () => {
    const homebrew = {
      meta: { name: 'Roundtrip', spec_version: '1.0' },
      attributes: [{ key: 'x', label: 'X' }],
      dice: { check: '2d6' },
      formulas: { double: { $: '*', args: ['@x', 2] } },
    };
    const source = blankState();
    source.settings.system = 'roundtrip';
    source.settings.systemConfig = homebrew;

    // Simulate serialisation the way the file writer does.
    const archive = JSON.parse(JSON.stringify(exportCampaign(source)));

    const dest = blankState();
    importCampaign(dest, archive);

    expect(dest.settings.systemConfig).toEqual(homebrew);
    expect(dest.settings.system).toBe('roundtrip');
  });

  it('retired-slug archive still carries the inline ruleset', () => {
    // Simulates a room saved years ago when `pathfinder` was a shipped
    // preset. The engine no longer registers that slug, but the archive
    // should carry the ruleset inline so importCampaign can restore it.
    const pathfinderSnapshot = {
      meta: { name: 'Pathfinder (retired preset snapshot)', spec_version: '1.0' },
      attributes: [{ key: 'str', label: 'STR' }],
      dice: { check: '1d20' },
    };
    const state = blankState();
    state.settings.system = 'pathfinder';
    state.settings.systemConfig = pathfinderSnapshot;

    const archive = exportCampaign(state);
    const dest = blankState();
    importCampaign(dest, archive);

    expect(dest.settings.systemConfig).toEqual(pathfinderSnapshot);
  });
});

/**
 * Walls and templates must round-trip through
 * exportCampaign → importCampaign without loss.
 *
 * Fog is per-map; all maps' fog must survive export/import.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { exportCampaign, importCampaign } from '../ui/import-export.js';
import { fogSignal } from '../state/signals.js';

function mockMap() {
  const m = new Map();
  m.replace = (next) => { m.clear(); for (const [k, v] of next) m.set(k, v); };
  return m;
}

function makeState() {
  return {
    settings: {},
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

describe('exportCampaign per-map fog round-trip', () => {
  beforeEach(() => {
    fogSignal.value = new Map();
  });

  it('exports fog as an object keyed by mapId', () => {
    fogSignal.value = new Map([
      ['map-1', { mode: 'hidden', revealed: ['0,0'] }],
      ['map-2', { mode: 'visible', revealed: [] }],
    ]);
    const sm = makeState();
    const archive = exportCampaign(sm);
    expect(archive.fog).toEqual({
      'map-1': { mode: 'hidden', revealed: ['0,0'] },
      'map-2': { mode: 'visible', revealed: [] },
    });
  });

  it('restores all maps\' fog on import (per-map format)', () => {
    fogSignal.value = new Map([
      ['map-a', { mode: 'hidden', revealed: ['1,1', '2,2'] }],
      ['map-b', { mode: 'visible', revealed: [] }],
    ]);
    const sm = makeState();
    const archive = JSON.parse(JSON.stringify(exportCampaign(sm)));

    // Clear fog before import.
    fogSignal.value = new Map();
    importCampaign(sm, archive);

    expect(fogSignal.value.get('map-a')).toEqual({ mode: 'hidden', revealed: ['1,1', '2,2'] });
    expect(fogSignal.value.get('map-b')).toEqual({ mode: 'visible', revealed: [] });
  });

  it('handles legacy single-map fog on import (mode at top level)', () => {
    const sm = makeState();
    sm.maps.set('map-x', { name: 'First' });
    sm.activeMapId = 'map-x';
    fogSignal.value = new Map();

    const legacyArchive = {
      ...exportCampaign(sm),
      fog: { mode: 'dim', revealed: ['3,3'] },
    };
    importCampaign(sm, legacyArchive);

    expect(fogSignal.value.get('map-x')).toEqual({ mode: 'dim', revealed: ['3,3'] });
  });
});

describe('exportCampaign walls + templates parity', () => {
  it('walls appear in export', () => {
    const sm = makeState();
    sm.walls.set('wall-1', { x1: 0, y1: 0, x2: 100, y2: 0, blocks_sight: true });
    const archive = exportCampaign(sm);
    expect(archive.walls).toEqual([
      { id: 'wall-1', x1: 0, y1: 0, x2: 100, y2: 0, blocks_sight: true },
    ]);
  });

  it('walls restore on import', () => {
    const source = makeState();
    source.walls.set('wall-1', { x1: 0, y1: 0, x2: 100, y2: 0, blocks_sight: true });
    const archive = exportCampaign(source);

    const target = makeState();
    importCampaign(target, archive);
    expect(target.walls.get('wall-1')).toMatchObject({
      x1: 0, y1: 0, x2: 100, y2: 0, blocks_sight: true,
    });
  });

  it('templates appear in export', () => {
    const sm = makeState();
    sm.templates.set('tpl-1', { shape: 'circle', col: 5, row: 5, radius_ft: 20 });
    const archive = exportCampaign(sm);
    expect(archive.templates).toEqual([
      { id: 'tpl-1', shape: 'circle', col: 5, row: 5, radius_ft: 20 },
    ]);
  });

  it('templates restore on import', () => {
    const source = makeState();
    source.templates.set('tpl-1', { shape: 'circle', col: 5, row: 5, radius_ft: 20 });
    const archive = exportCampaign(source);

    const target = makeState();
    importCampaign(target, archive);
    expect(target.templates.get('tpl-1')).toMatchObject({
      shape: 'circle', col: 5, row: 5, radius_ft: 20,
    });
  });
});

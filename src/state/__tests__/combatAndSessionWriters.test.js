/**
 * Direct coverage for the combat-writers (initiative + damage log +
 * templates) and session-writers (settings + tombstoneForeignEvent)
 * modules. Post-1.1b every VTT write goes through Yjs.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  updateInitiative,
  clearInitiative,
  recordDamage,
  addTemplate,
  updateTemplate,
  removeTemplate,
  clearTemplates,
} from '../writers/combat-writers.js';
import {
  updateSettings,
  setActiveMap,
} from '../writers/session-writers.js';
import { EVENT_TYPES } from '../../utils/constants.js';

function makeYMap() {
  const inner = new Map();
  return {
    set: vi.fn((k, v) => inner.set(k, v)),
    delete: vi.fn((k) => inner.delete(k)),
    has: (k) => inner.has(k),
    get: (k) => inner.get(k),
    doc: { transact: (fn) => fn() },
    keys: () => inner.keys(),
  };
}

function makeSm() {
  return {
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    settings: { gm_user_ids: ['@gm:m'], active_map_id: 'm0' },
    powerLevels: { users: { '@gm:m': 50 } },
    widgetManager: { userId: '@gm:m' },
    templates: new Map(),
    damageLog: [],
    yjs: {
      initiativeMap: makeYMap(),
      templatesMap: makeYMap(),
      settingsMap: makeYMap(),
    },
    sendStateEvent: vi.fn().mockResolvedValue({}),
  };
}

describe('initiative writers (Yjs-routed)', () => {
  it('updateInitiative writes through yjs.initiativeMap', async () => {
    const sm = makeSm();
    const init = { active: true, round: 1, current_index: 0, order: [{ name: 'Aria' }] };
    await updateInitiative(sm, init);
    expect(sm.yjs.initiativeMap.set).toHaveBeenCalledWith('', init);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('clearInitiative resets to the empty shape via Yjs', async () => {
    const sm = makeSm();
    await clearInitiative(sm);
    const persisted = sm.yjs.initiativeMap.set.mock.calls[0][1];
    expect(persisted).toEqual({ active: false, round: 0, current_index: 0, order: [] });
  });
});

describe('damage log', () => {
  it('appends a normalised entry, defaulting missing fields', () => {
    const sm = makeSm();
    recordDamage(sm, { actor: '@gm:m', target_id: 't1', delta: -5 });
    expect(sm.damageLog).toHaveLength(1);
    expect(sm.damageLog[0]).toMatchObject({
      actor: '@gm:m', target_id: 't1', delta: -5, kind: 'damage', source: null,
    });
  });

  it('coerces a non-numeric delta to 0', () => {
    const sm = makeSm();
    recordDamage(sm, { actor: '@gm:m', delta: '-5' });
    expect(sm.damageLog[0].delta).toBe(0);
  });

  it('caps the log at 100 entries', () => {
    const sm = makeSm();
    for (let i = 0; i < 110; i++) recordDamage(sm, { delta: i });
    expect(sm.damageLog).toHaveLength(100);
    expect(sm.damageLog[0].delta).toBe(10);
    expect(sm.damageLog[99].delta).toBe(109);
  });

  it('ignores non-object entries', () => {
    const sm = makeSm();
    recordDamage(sm, null);
    recordDamage(sm, 'oops');
    recordDamage(sm, undefined);
    expect(sm.damageLog).toHaveLength(0);
  });
});

describe('template writers (Yjs-routed)', () => {
  it('addTemplate rejects templates without id', async () => {
    const sm = makeSm();
    await expect(addTemplate(sm, { shape: 'circle' })).rejects.toThrow(/must have id/);
  });

  it('addTemplate writes through yjs.templatesMap', async () => {
    const sm = makeSm();
    await addTemplate(sm, { id: 't1', shape: 'circle' });
    expect(sm.yjs.templatesMap.set).toHaveBeenCalledWith('t1', { id: 't1', shape: 'circle' });
  });

  it('updateTemplate merges the patch and writes the merged template', async () => {
    const sm = makeSm();
    sm.templates.set('t1', { id: 't1', shape: 'circle', radius: 10 });
    await updateTemplate(sm, 't1', { radius: 20 });
    const stored = sm.yjs.templatesMap.set.mock.calls[0][1];
    expect(stored.radius).toBe(20);
  });

  it('removeTemplate deletes via yjs.templatesMap', async () => {
    const sm = makeSm();
    sm.templates.set('t1', { id: 't1' });
    await removeTemplate(sm, 't1');
    expect(sm.yjs.templatesMap.delete).toHaveBeenCalledWith('t1');
  });

  it('clearTemplates deletes every template via the Y.Doc transaction', async () => {
    const sm = makeSm();
    sm.templates.set('t1', { id: 't1' });
    sm.templates.set('t2', { id: 't2' });
    await clearTemplates(sm);
    expect(sm.yjs.templatesMap.delete).toHaveBeenCalledTimes(2);
  });
});

describe('session writers (Yjs-routed)', () => {
  it('updateSettings strips systemConfig for builtin system slugs', async () => {
    const sm = makeSm();
    const next = { gm_user_ids: ['@gm:m'], active_map_id: 'm0', system: 'dnd5e', systemConfig: { presets: [] } };
    await updateSettings(sm, next);
    const persisted = sm.yjs.settingsMap.set.mock.calls[0][1];
    expect(persisted.systemConfig).toBeUndefined();
    expect(persisted.gm_user_ids).toEqual(['@gm:m']);
  });

  it('setActiveMap merges active_map_id into existing settings via Yjs', async () => {
    const sm = makeSm();
    sm.settings = { gm_user_ids: ['@gm:m'], active_map_id: 'm0' };
    await setActiveMap(sm, 'm5');
    expect(sm.yjs.settingsMap.set.mock.calls[0][1]).toEqual(
      { gm_user_ids: ['@gm:m'], active_map_id: 'm5' }
    );
  });

});

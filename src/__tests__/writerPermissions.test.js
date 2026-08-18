/**
 * Writer-layer GM permission gates.
 *
 * The security boundary lives at the writer layer: every GM-only writer
 * must reject non-GM callers with VTTError(ErrorType.PERMISSION), even
 * if a UI-side guard is bypassed. These tests assert each gate
 * independently of any UI wrapping.
 *
 * Pattern mirrors `src/state/__tests__/facadeWriters.test.js` - real
 * StateManager + spies on yjs maps. GM state is toggled via
 * `sm.powerLevels`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../state/StateManager.js';
import { VTTError, ErrorType } from '../utils/errorHandling.js';

const ME = '@me:s';

function mkSM({ gm = false } = {}) {
  const widgetManager = {
    sendStateEvent: vi.fn(async () => 'evt-1'),
    userId: ME,
    isStandalone: true,
    roomId: '!r:s',
  };
  const sm = new StateManager(widgetManager, null);
  sm.settings = { name: 'S', system: 'generic', grid_px: 40 };
  if (gm) sm.powerLevels = { users: { [ME]: 50 } };
  return sm;
}

function expectPermissionError(err) {
  expect(err).toBeInstanceOf(VTTError);
  expect(err.type).toBe(ErrorType.PERMISSION);
}

async function expectRejectsPermission(promise) {
  let caught;
  try { await promise; } catch (e) { caught = e; }
  expect(caught, 'writer should reject for non-GM').toBeDefined();
  expectPermissionError(caught);
}

// ─── session-writers ──────────────────────────────────────────────────────

describe('session-writers - GM gates', () => {
  it('updateSettings rejects non-GM', async () => {
    const sm = mkSM({ gm: false });
    const setSpy = vi.spyOn(sm.yjs.settingsMap, 'set');
    await expectRejectsPermission(sm.updateSettings({ name: 'X' }));
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('updateSettings allows GM', async () => {
    const sm = mkSM({ gm: true });
    const setSpy = vi.spyOn(sm.yjs.settingsMap, 'set');
    await sm.updateSettings({ gm_user_ids: [ME], name: 'X', system: 'generic', grid_px: 40 });
    expect(setSpy).toHaveBeenCalled();
  });
});

// ─── combat-writers ───────────────────────────────────────────────────────

describe('combat-writers - GM gates', () => {
  describe('non-GM rejected', () => {
    let sm;
    beforeEach(() => { sm = mkSM({ gm: false }); });

    it('updateInitiative', async () => {
      const s = vi.spyOn(sm.yjs.initiativeMap, 'set');
      await expectRejectsPermission(sm.updateInitiative({ active: true, round: 1, current_index: 0, order: [] }));
      expect(s).not.toHaveBeenCalled();
    });

    it('clearInitiative', async () => {
      const s = vi.spyOn(sm.yjs.initiativeMap, 'set');
      await expectRejectsPermission(sm.clearInitiative());
      expect(s).not.toHaveBeenCalled();
    });

    it('addTemplate', async () => {
      const s = vi.spyOn(sm.yjs.templatesMap, 'set');
      await expectRejectsPermission(sm.addTemplate({ id: 't-1' }));
      expect(s).not.toHaveBeenCalled();
    });

    it('updateTemplate', async () => {
      sm.templates.set('t-1', { id: 't-1' });
      const s = vi.spyOn(sm.yjs.templatesMap, 'set');
      await expectRejectsPermission(sm.updateTemplate('t-1', { x: 1 }));
      expect(s).not.toHaveBeenCalled();
    });

    it('removeTemplate', async () => {
      sm.templates.set('t-1', { id: 't-1' });
      const s = vi.spyOn(sm.yjs.templatesMap, 'delete');
      await expectRejectsPermission(sm.removeTemplate('t-1'));
      expect(s).not.toHaveBeenCalled();
    });

    it('clearTemplates', async () => {
      sm.templates.set('t-1', { id: 't-1' });
      const s = vi.spyOn(sm.yjs.templatesMap, 'delete');
      await expectRejectsPermission(sm.clearTemplates());
      expect(s).not.toHaveBeenCalled();
    });
  });

  describe('GM allowed', () => {
    let sm;
    beforeEach(() => { sm = mkSM({ gm: true }); });

    it('updateInitiative writes', async () => {
      const s = vi.spyOn(sm.yjs.initiativeMap, 'set');
      const init = { active: true, round: 1, current_index: 0, order: [] };
      await sm.updateInitiative(init);
      expect(s).toHaveBeenCalledWith('', init);
    });

    it('addTemplate writes', async () => {
      const s = vi.spyOn(sm.yjs.templatesMap, 'set');
      await sm.addTemplate({ id: 't-1', shape: 'circle' });
      expect(s).toHaveBeenCalledWith('t-1', { id: 't-1', shape: 'circle' });
    });
  });
});

// ─── world-writers ────────────────────────────────────────────────────────

describe('world-writers - GM gates', () => {
  describe('non-GM rejected (fog)', () => {
    it('updateFog', async () => {
      const sm = mkSM({ gm: false });
      sm.activeMapId = 'map-1';
      const s = vi.spyOn(sm.yjs.fogMap, 'set');
      await expectRejectsPermission(sm.updateFog({ mode: 'hidden', revealed: [] }));
      expect(s).not.toHaveBeenCalled();
    });

  });

  describe('non-GM rejected (maps)', () => {
    let sm;
    beforeEach(() => { sm = mkSM({ gm: false }); });

    it('createMap', async () => {
      await expectRejectsPermission(sm.createMap({ name: 'M', width_cells: 10, height_cells: 10, cell_px: 40 }));
    });

    it('updateMap', async () => {
      await expectRejectsPermission(sm.updateMap('m-1', { name: 'X' }));
    });

    it('deleteMap', async () => {
      sm.maps.set('m-1', { id: 'm-1' });
      sm.maps.set('m-2', { id: 'm-2' });
      await expectRejectsPermission(sm.deleteMap('m-1'));
    });
  });

  describe('non-GM rejected (walls)', () => {
    let sm;
    beforeEach(() => { sm = mkSM({ gm: false }); });

    it('addWall', async () => {
      const s = vi.spyOn(sm.yjs.wallsMap, 'set');
      await expectRejectsPermission(sm.addWall({ id: 'w-1' }));
      expect(s).not.toHaveBeenCalled();
    });

    it('updateWall', async () => {
      sm.walls.set('w-1', { id: 'w-1' });
      const s = vi.spyOn(sm.yjs.wallsMap, 'set');
      await expectRejectsPermission(sm.updateWall('w-1', { door: true }));
      expect(s).not.toHaveBeenCalled();
    });

    it('removeWall', async () => {
      sm.walls.set('w-1', { id: 'w-1' });
      const s = vi.spyOn(sm.yjs.wallsMap, 'delete');
      await expectRejectsPermission(sm.removeWall('w-1'));
      expect(s).not.toHaveBeenCalled();
    });

    it('clearWalls', async () => {
      sm.walls.set('w-1', { id: 'w-1' });
      const s = vi.spyOn(sm.yjs.wallsMap, 'delete');
      await expectRejectsPermission(sm.clearWalls());
      expect(s).not.toHaveBeenCalled();
    });
  });

  describe('non-GM rejected (lights)', () => {
    let sm;
    beforeEach(() => { sm = mkSM({ gm: false }); });

    it('addLight', async () => {
      const s = vi.spyOn(sm.yjs.lightsMap, 'set');
      await expectRejectsPermission(sm.addLight({ id: 'l-1' }));
      expect(s).not.toHaveBeenCalled();
    });

    it('updateLight', async () => {
      sm.lights.set('l-1', { id: 'l-1' });
      const s = vi.spyOn(sm.yjs.lightsMap, 'set');
      await expectRejectsPermission(sm.updateLight('l-1', { bright: 20 }));
      expect(s).not.toHaveBeenCalled();
    });

    it('removeLight', async () => {
      sm.lights.set('l-1', { id: 'l-1' });
      const s = vi.spyOn(sm.yjs.lightsMap, 'delete');
      await expectRejectsPermission(sm.removeLight('l-1'));
      expect(s).not.toHaveBeenCalled();
    });

    it('clearLights', async () => {
      sm.lights.set('l-1', { id: 'l-1' });
      const s = vi.spyOn(sm.yjs.lightsMap, 'delete');
      await expectRejectsPermission(sm.clearLights());
      expect(s).not.toHaveBeenCalled();
    });
  });

  describe('non-GM rejected (pins)', () => {
    let sm;
    beforeEach(() => { sm = mkSM({ gm: false }); });

    it('addPin', async () => {
      const s = vi.spyOn(sm.yjs.pinsMap, 'set');
      await expectRejectsPermission(sm.addPin({ id: 'p-1' }));
      expect(s).not.toHaveBeenCalled();
    });

    it('updatePin', async () => {
      sm.pins.set('p-1', { id: 'p-1' });
      const s = vi.spyOn(sm.yjs.pinsMap, 'set');
      await expectRejectsPermission(sm.updatePin('p-1', { label: 'x' }));
      expect(s).not.toHaveBeenCalled();
    });

    it('removePin', async () => {
      sm.pins.set('p-1', { id: 'p-1' });
      const s = vi.spyOn(sm.yjs.pinsMap, 'delete');
      await expectRejectsPermission(sm.removePin('p-1'));
      expect(s).not.toHaveBeenCalled();
    });
  });

  describe('non-GM rejected (drawings)', () => {
    let sm;
    beforeEach(() => { sm = mkSM({ gm: false }); });

    it('addDrawing', async () => {
      const before = sm.yjs.drawingsArray.length;
      await expectRejectsPermission(sm.addDrawing({ id: 'd-1', points: [] }));
      expect(sm.yjs.drawingsArray.length).toBe(before);
    });

    it('removeDrawing', async () => {
      await expectRejectsPermission(sm.removeDrawing('d-1'));
    });

    it('clearDrawings', async () => {
      await expectRejectsPermission(sm.clearDrawings());
    });

    it('undoDrawing', async () => {
      await expectRejectsPermission(sm.undoDrawing());
    });

    it('redoDrawing', async () => {
      await expectRejectsPermission(sm.redoDrawing());
    });
  });

  describe('GM allowed', () => {
    let sm;
    beforeEach(() => { sm = mkSM({ gm: true }); });

    it('updateFog writes', async () => {
      sm.activeMapId = 'map-1';
      const s = vi.spyOn(sm.yjs.fogMap, 'set');
      await sm.updateFog({ mode: 'hidden', revealed: [] });
      expect(s).toHaveBeenCalledWith('map-1', { mode: 'hidden', revealed: [] });
    });

    it('addWall writes (with valid payload shape)', async () => {
      sm.activeMapId = 'map-1';
      const s = vi.spyOn(sm.yjs.wallsMap, 'set');
      const wall = { id: 'w-1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } };
      await sm.addWall(wall);
      expect(s).toHaveBeenCalled();
      expect(s.mock.calls[0][0]).toBe('w-1');
      expect(s.mock.calls[0][1].map_id).toBe('map-1');
    });

    it('addLight writes (with valid payload shape)', async () => {
      sm.activeMapId = 'map-1';
      const s = vi.spyOn(sm.yjs.lightsMap, 'set');
      await sm.addLight({ id: 'l-1', x: 100, y: 100, radius_px: 60 });
      expect(s).toHaveBeenCalled();
      expect(s.mock.calls[0][1].map_id).toBe('map-1');
    });

    it('addPin writes (with valid payload shape)', async () => {
      sm.activeMapId = 'map-1';
      const s = vi.spyOn(sm.yjs.pinsMap, 'set');
      await sm.addPin({ id: 'p-1', col: 1, row: 2, label: 'X' });
      expect(s).toHaveBeenCalled();
      expect(s.mock.calls[0][1].map_id).toBe('map-1');
    });

    it('addDrawing writes', async () => {
      const before = sm.yjs.drawingsArray.length;
      await sm.addDrawing({ id: 'd-1', points: [0, 0, 1, 1] });
      expect(sm.yjs.drawingsArray.length).toBe(before + 1);
    });
  });
});

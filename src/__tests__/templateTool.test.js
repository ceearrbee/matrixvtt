/**
 * Persistent circle-template tool: builds a com.vtt.template entity
 * from click origin + drag radius, GM-only, eraseable via the erase tool.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import Konva from 'konva';
import { buildTemplate, setupTools } from '../map/input/tools.js';

beforeAll(() => {
  if (HTMLCanvasElement.prototype.getContext.__stubbed) return;
  const make2d = () => new Proxy({
    canvas: null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
  }, {
    get(t, p) { return p in t ? t[p] : () => undefined; },
    set(t, p, v) { t[p] = v; return true; },
  });
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (k) {
    if (k === '2d') { const c = make2d(); c.canvas = this; return c; }
    return orig ? orig.call(this, k) : null;
  };
  HTMLCanvasElement.prototype.getContext.__stubbed = true;
});

describe('buildTemplate', () => {
  const mr = { state: { map: { cell_px: 40 }, widgetManager: { userId: '@gm:x' } }, drawColor: '#abcdef' };

  it('returns a circle template with origin in cells and radius in cells', () => {
    const t = buildTemplate(mr, { x: 80, y: 80 }, { x: 200, y: 80 });
    expect(t.shape).toBe('circle');
    expect(t.origin).toEqual({ col: 2, row: 2 });
    expect(t.radius).toBe(3);
    expect(t.color).toBe('#abcdef');
    expect(t.creator_id).toBe('@gm:x');
  });

  it('clamps radius to at least 1 cell', () => {
    const t = buildTemplate(mr, { x: 0, y: 0 }, { x: 5, y: 0 });
    expect(t.radius).toBe(1);
  });

  it('returns null for missing endpoints', () => {
    expect(buildTemplate(mr, null, { x: 0, y: 0 })).toBeNull();
    expect(buildTemplate(mr, { x: 0, y: 0 }, null)).toBeNull();
  });
});

function makeRig({ activeTool, isGM = true, templates = [], walls = [], drawings = [] }) {
  const tplMap = new Map();
  for (const t of templates) tplMap.set(t.id, t);
  const wallMap = new Map();
  for (const w of walls) wallMap.set(w.id, w);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: 400, height: 300 });
  const mr = {
    stage, zoom: 1, panX: 0, panY: 0,
    activeTool,
    drawColor: '#ff6b6b', drawWidth: 2,
    state: {
      tokens: new Map(),
      drawings,
      walls: wallMap,
      templates: tplMap,
      map: { cell_px: 40 },
      widgetManager: { userId: '@gm:x' },
      isGM: () => isGM,
      addTemplate: vi.fn().mockResolvedValue(undefined),
      addDrawing: vi.fn().mockResolvedValue(undefined),
      addWall: vi.fn().mockResolvedValue(undefined),
      removeDrawing: vi.fn().mockResolvedValue(undefined),
      removeWall: vi.fn().mockResolvedValue(undefined),
      removeTemplate: vi.fn().mockResolvedValue(undefined),
    },
    render: vi.fn(),
    _getTokenRadius: () => 15,
  };
  const dispose = setupTools(mr);
  return { stage, mr, container, dispose };
}

describe('template-circle finalize path', () => {
  let rig;
  afterEach(() => { rig?.dispose(); rig?.stage.destroy(); rig?.container.remove(); });

  it('routes through state.addTemplate when activeTool is template-circle', async () => {
    rig = makeRig({ activeTool: 'template-circle' });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 80, clientY: 80 }, target: rig.stage });
    rig.stage._fire('mouseup', { evt: { button: 0, clientX: 200, clientY: 80 } });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.addTemplate).toHaveBeenCalledTimes(1);
    expect(rig.mr.state.addDrawing).not.toHaveBeenCalled();
  });

  it('does not create templates for non-GM users', async () => {
    rig = makeRig({ activeTool: 'template-circle', isGM: false });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 80, clientY: 80 }, target: rig.stage });
    rig.stage._fire('mouseup', { evt: { button: 0, clientX: 200, clientY: 80 } });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.addTemplate).not.toHaveBeenCalled();
  });
});

describe('erase tool removes templates', () => {
  let rig;
  afterEach(() => { rig?.dispose(); rig?.stage.destroy(); rig?.container.remove(); });

  it('clicks inside a circle template remove it (GM)', async () => {
    const template = {
      id: 'tpl1', shape: 'circle',
      origin: { col: 2, row: 2 }, radius: 3, color: '#abc',
    };
    rig = makeRig({ activeTool: 'erase', templates: [template] });
    rig.stage._fire('mousedown', { evt: { button: 0, clientX: 80, clientY: 80 }, target: rig.stage });
    await Promise.resolve(); await Promise.resolve();
    expect(rig.mr.state.removeTemplate).toHaveBeenCalledWith('tpl1');
  });
});

/**
 * Scene-setup tools: the light-placement tool and the add-token
 * placement flow. Both need a home on the map surface: lights must be
 * placeable somewhere, and add-token must not require guessing
 * right-click.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildLight } from '../map/input/strokes.js';
import { placeLightAt, consumePendingPlacement } from '../map/input/tools.js';
import { pendingPlacementSignal } from '../state/signals.js';

function makeMr({ isGM = true, map = { id: 'map-1', cell_px: 40, width_cells: 20, height_cells: 20 } } = {}) {
  return {
    state: {
      isGM: () => isGM,
      map,
      addLight: vi.fn(async () => {}),
      tokens: new Map(),
    },
    showAddTokenDialog: vi.fn(),
    render: vi.fn(),
  };
}

describe('buildLight', () => {
  it('builds a light at the click point with a three-cell default radius', () => {
    const light = buildLight(makeMr(), 100, 220);
    expect(light.id).toMatch(/^light-/);
    expect(light.map_id).toBe('map-1');
    expect(light.x).toBe(100);
    expect(light.y).toBe(220);
    expect(light.radius_px).toBe(120);
  });

  it('returns null when no map is active', () => {
    expect(buildLight(makeMr({ map: null }), 10, 10)).toBeNull();
  });
});

describe('placeLightAt', () => {
  it('writes the light through state.addLight for a GM', async () => {
    const mr = makeMr();
    await placeLightAt(mr, 100, 220);
    expect(mr.state.addLight).toHaveBeenCalledWith(expect.objectContaining({
      map_id: 'map-1', x: 100, y: 220, radius_px: 120,
    }));
  });

  it('is a no-op for players', async () => {
    const mr = makeMr({ isGM: false });
    await placeLightAt(mr, 100, 220);
    expect(mr.state.addLight).not.toHaveBeenCalled();
  });
});

describe('consumePendingPlacement: new-token', () => {
  it('opens the add-token dialog at the clicked cell and clears the pending flag', async () => {
    const mr = makeMr();
    pendingPlacementSignal.value = { kind: 'new-token' };
    const consumed = await consumePendingPlacement(mr, 205, 85);
    expect(consumed).toBe(true);
    expect(pendingPlacementSignal.value).toBe(null);
    expect(mr.showAddTokenDialog).toHaveBeenCalledWith(5, 2);
  });

  it('does nothing when no placement is pending', async () => {
    pendingPlacementSignal.value = null;
    const mr = makeMr();
    const consumed = await consumePendingPlacement(mr, 205, 85);
    expect(consumed).toBe(false);
    expect(mr.showAddTokenDialog).not.toHaveBeenCalled();
  });
});

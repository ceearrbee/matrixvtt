/**
 * `startAreaSelection(mode)` puts the renderer into marquee mode so
 * the next mousedown/move/up sweeps a rectangle and commits a fog
 * reveal/hide via `completeAreaSelection`. Pre-fix, this entry point
 * existed but had been dropped during the Konva phase 6/7 migration
 * and was unreachable from any UI surface.
 */
import { describe, it, expect, vi } from 'vitest';
import { startAreaSelection, completeAreaSelection, toggleSingleFogCell } from '../map/actions/fog.js';

function makeMr({ isGM = true } = {}) {
  return {
    state: {
      isGM: () => isGM,
      map: { cell_px: 40, width_cells: 10, height_cells: 10 },
      fog: { revealed: [] },
      updateFog: vi.fn(async () => {}),
    },
    stage: { container: () => ({ style: { cursor: '' } }) },
    render: vi.fn(),
    _toast: vi.fn(),
  };
}

describe('startAreaSelection', () => {
  it('arms reveal mode for a GM', () => {
    const mr = makeMr({ isGM: true });
    startAreaSelection(mr, 'reveal');
    expect(mr.areaSelectionMode).toBe('reveal');
    expect(mr.areaSelectionStart).toBeNull();
    expect(mr.render).toHaveBeenCalled();
  });

  it('rejects an unknown mode', () => {
    const mr = makeMr({ isGM: true });
    startAreaSelection(mr, 'nonsense');
    expect(mr.areaSelectionMode).toBeUndefined();
  });

  it('refuses non-GMs', () => {
    const mr = makeMr({ isGM: false });
    startAreaSelection(mr, 'reveal');
    expect(mr.areaSelectionMode).toBeUndefined();
  });

  it('toggleSingleFogCell toggles the cell at (col,row), not (0,0)', async () => {
    // The right-click menu passes col/row directly; dividing by
    // cell_px again would make every right-click "Toggle Fog Cell"
    // toggle (0,0).
    const mr = makeMr({ isGM: true });
    await toggleSingleFogCell(mr, 5, 7);
    const call = mr.state.updateFog.mock.calls[0][0];
    expect(call.revealed).toEqual(['5,7']);
  });

  it('end-to-end: arm + sweep + complete reveals the swept cells', async () => {
    const mr = makeMr({ isGM: true });
    startAreaSelection(mr, 'reveal');
    mr.areaSelectionStart = { x: 0, y: 0 };
    mr.areaSelectionCurrent = { x: 80, y: 40 }; // 2 cols × 1 row, with the floor() math
    await completeAreaSelection(mr);
    const call = mr.state.updateFog.mock.calls[0][0];
    expect(call.revealed.sort()).toEqual(['0,0', '0,1', '1,0', '1,1', '2,0', '2,1']);
  });
});

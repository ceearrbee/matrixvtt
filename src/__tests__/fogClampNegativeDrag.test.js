/**
 * Fog area selection clamps to map bounds.
 *
 * A drag starting past the panned origin produces negative world coords;
 * without clamping the resulting fog cell keys looked like "-1,5" -
 * legal storage but a data quirk that downstream readers don't expect.
 */
import { describe, it, expect, vi } from 'vitest';
import { completeAreaSelection } from '../map/actions/fog.js';

function makeMr({ start, current, mode = 'reveal' }) {
  return {
    areaSelectionMode: mode,
    areaSelectionStart: start,
    areaSelectionCurrent: current,
    state: {
      map: { cell_px: 40, width_cells: 5, height_cells: 5 },
      fog: { revealed: [] },
      updateFog: vi.fn().mockResolvedValue(),
    },
    render: vi.fn(),
  };
}

function keysFromCall(mr) {
  const last = mr.state.updateFog.mock.calls.at(-1);
  return last ? Array.from(last[0]?.revealed || []) : [];
}

describe('fog area selection clamps to map bounds', () => {
  it('drag starting past the panned origin produces no negative keys', async () => {
    const mr = makeMr({ start: { x: -120, y: -200 }, current: { x: 80, y: 80 } });
    await completeAreaSelection(mr);
    for (const key of keysFromCall(mr)) {
      const [c, r] = key.split(',').map(Number);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(r).toBeGreaterThanOrEqual(0);
    }
  });

  it('drag past the bottom-right edge clamps to the last in-bounds cell', async () => {
    const mr = makeMr({ start: { x: 80, y: 80 }, current: { x: 9999, y: 9999 } });
    await completeAreaSelection(mr);
    for (const key of keysFromCall(mr)) {
      const [c, r] = key.split(',').map(Number);
      expect(c).toBeLessThanOrEqual(4);
      expect(r).toBeLessThanOrEqual(4);
    }
  });
});

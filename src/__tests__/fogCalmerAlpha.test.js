/**
 * GM fog overlay drops from 0.45 → 0.30 alpha in Narrative mode so the
 * overlay reads "atmospheric" rather than "oppressive" while the table
 * is in conversation. Player fog stays fully opaque - it's a
 * hide-vs-reveal contract, not a stylistic dial.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { paintFog } from '../map/layers/fog.js';
import { tablePhaseSignal } from '../state/ui-signals.js';
import { FOG_MODES } from '../utils/ui-constants.js';
import { UI_MODES } from '../utils/constants.js';

function mkCtx() {
  return {
    fillStyle: '',
    _rectCalls: [],
    _filled: false,
    beginPath() {},
    rect(...args) { this._rectCalls.push(args); },
    fill() { this._filled = true; },
  };
}

function mkMr({ isGM }) {
  return {
    state: {
      map: { width_cells: 4, height_cells: 4, cell_px: 40 },
      fog: { mode: FOG_MODES.HIDDEN, revealed: [] },
      isGM: () => isGM,
    },
  };
}

describe('paintFog alpha - Narrative mode', () => {
  beforeEach(() => { tablePhaseSignal.value = UI_MODES.COMBAT; });

  it('GM outside Narrative: 0.45', () => {
    const ctx = mkCtx();
    paintFog(ctx, mkMr({ isGM: true }));
    expect(ctx.fillStyle).toBe('rgba(0, 0, 0, 0.45)');
  });

  it('GM in Narrative: 0.30', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    const ctx = mkCtx();
    paintFog(ctx, mkMr({ isGM: true }));
    expect(ctx.fillStyle).toBe('rgba(0, 0, 0, 0.3)');
  });

  it('Player fog is always 1.0 regardless of mode', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    const ctx = mkCtx();
    paintFog(ctx, mkMr({ isGM: false }));
    expect(ctx.fillStyle).toBe('rgba(0, 0, 0, 1)');
  });
});

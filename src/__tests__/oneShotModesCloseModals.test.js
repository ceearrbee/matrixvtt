/**
 * One-shot map modes close any open modals before arming.
 *
 * The drop-on-map / facing / ping flows all set a pending state that
 * the next map click consumes. If a modal is open at the moment that
 * pending state is set, the next click hits the modal backdrop, the
 * modal dismisses, and the map never sees the click - the action
 * silently fails.
 *
 * Every entry point that arms a one-shot map mode must clean modals
 * first.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { attachMapControls } from '../ui/map-controls-wiring.js';
import { beginItemDrop } from '../ui/tables/loot-actions.js';
import { pendingPlacementSignal } from '../state/signals.js';

function stubModals() {
  document.body.innerHTML = `
    <div class="modal-overlay" id="some-modal"></div>
    <div class="modal-overlay" id="another-modal"></div>
  `;
}

describe('one-shot map modes close modals first', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    pendingPlacementSignal.value = null;
  });

  it('ping mode (`ui.pingLocation`) clears modal overlays before arming', () => {
    stubModals();
    const mapRenderer = { _pingMode: false };
    const ui = { mapRenderer };
    attachMapControls(ui);
    ui.pingLocation();
    expect(mapRenderer._pingMode).toBe(true);
    expect(document.querySelectorAll('.modal-overlay').length).toBe(0);
  });

  it('drop-on-map (`beginItemDrop`) clears modal overlays before arming', () => {
    stubModals();
    const ui = { state: {}, _toast: vi.fn() };
    beginItemDrop(ui, 'itm-x');
    expect(pendingPlacementSignal.value).toEqual({ kind: 'item-token', itemId: 'itm-x' });
    expect(document.querySelectorAll('.modal-overlay').length).toBe(0);
  });

  it('facing mode (`startFacingMode`) clears modal overlays before arming', async () => {
    stubModals();
    // startFacingMode isn't exported; reach it via the side-effecting
    // attachMapActions wiring on a stub mr.
    const { attachMapActions } = await import('../map/map-actions-wiring.js');
    const mr = {
      stage: { container: () => document.body },
      canvas: document.body,
      state: { tokens: new Map() },
      _toast: () => {},
    };
    attachMapActions(mr);
    mr._startFacingMode('tok-1');
    expect(mr._facingModeTokenId).toBe('tok-1');
    expect(document.querySelectorAll('.modal-overlay').length).toBe(0);
  });
});

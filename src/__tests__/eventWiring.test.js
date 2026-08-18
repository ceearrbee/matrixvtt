/**
 * Event-dispatch wiring split out of src/ui/ui-methods.js. Each method
 * is a thin adapter onto a pure function in state-updater.js; the test
 * locks in the delegation contract so the split can't regress.
 */
import { describe, it, expect, vi } from 'vitest';

// The module imports from '../ui/state-updater.js' - stub that before
// loading the module under test so we can assert on the delegations.
vi.mock('../ui/state-updater.js', () => ({
  handleDiceRollResult: vi.fn(),
  handleDamage: vi.fn(),
  handleHeal: vi.fn(),
  updateDiceResult: vi.fn(),
}));

import { attachEventHandlers } from '../ui/event-wiring.js';
import * as stateUpdater from '../ui/state-updater.js';

function makeUI() {
  return {
    _selectTokenAndSwitchTab: vi.fn(),
  };
}

describe('attachEventHandlers(ui)', () => {
  it('handleDiceRollResult forwards (ui, event)', () => {
    const ui = makeUI();
    attachEventHandlers(ui);
    const event = { detail: { total: 18 } };
    ui.handleDiceRollResult(event);
    expect(stateUpdater.handleDiceRollResult).toHaveBeenCalledWith(ui, event);
  });

  it('handleDamage forwards (ui, event)', () => {
    const ui = makeUI();
    attachEventHandlers(ui);
    const event = { detail: { damage: 5 } };
    ui.handleDamage(event);
    expect(stateUpdater.handleDamage).toHaveBeenCalledWith(ui, event);
  });

  it('handleHeal forwards (ui, event)', () => {
    const ui = makeUI();
    attachEventHandlers(ui);
    const event = { detail: { heal: 3 } };
    ui.handleHeal(event);
    expect(stateUpdater.handleHeal).toHaveBeenCalledWith(ui, event);
  });

  it('updateDiceResult forwards (ui, rollData)', () => {
    const ui = makeUI();
    attachEventHandlers(ui);
    const rollData = { expression: '1d20+5', total: 18 };
    ui.updateDiceResult(rollData);
    expect(stateUpdater.updateDiceResult).toHaveBeenCalledWith(ui, rollData);
  });

  it('handleViewSheet extracts detail.tokenId and calls _selectTokenAndSwitchTab', () => {
    const ui = makeUI();
    attachEventHandlers(ui);
    ui.handleViewSheet({ detail: { tokenId: 'tok-aria' } });
    expect(ui._selectTokenAndSwitchTab).toHaveBeenCalledWith('tok-aria');
  });
});

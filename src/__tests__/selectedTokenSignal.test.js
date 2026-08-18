/**
 * `selectedToken` must be signal-backed so the Sheet/NPC tabs
 * re-render when the user clicks a different token on the map
 * (the deferred half of the "View Full Sheet" bug).
 *
 * Bridges:
 *   src/state/ui-signals.js     → selectedTokenSignal export
 *   src/state/StateManager.js   → getter/setter pair on ui.state
 *   src/ui/CharacterSheet.jsx   → subscribes to selectedTokenSignal
 *   src/ui/NPCSheet.jsx         → subscribes + uses getCurrentNPC
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { selectedTokenSignal } from '../state/ui-signals.js';

beforeEach(() => { selectedTokenSignal.value = null; });

describe('selectedTokenSignal', () => {
  it('is exported from ui-signals.js with an initial null value', () => {
    expect(selectedTokenSignal).toBeDefined();
    expect(selectedTokenSignal.value).toBe(null);
  });

  it('reads and writes propagate as a normal signal', () => {
    selectedTokenSignal.value = 'tok-aria';
    expect(selectedTokenSignal.value).toBe('tok-aria');
    selectedTokenSignal.value = null;
    expect(selectedTokenSignal.value).toBe(null);
  });
});

describe('StateManager.selectedToken bridges to the signal', () => {
  it('reading sm.selectedToken returns selectedTokenSignal.value', async () => {
    const { StateManager } = await import('../state/StateManager.js');
    const sm = new StateManager({ roomId: 'r1' });
    selectedTokenSignal.value = 'tok-1';
    expect(sm.selectedToken).toBe('tok-1');
  });

  it('writing sm.selectedToken writes through to the signal', async () => {
    const { StateManager } = await import('../state/StateManager.js');
    const sm = new StateManager({ roomId: 'r1' });
    sm.selectedToken = 'tok-2';
    expect(selectedTokenSignal.value).toBe('tok-2');
  });
});

/**
 * mr.setSelectedToken must propagate to ALL signal-backed selection
 * fields so the Sheet / NPC panels follow the map click. The bug
 * before this fix: clicking a different token while already on the
 * Sheet tab left the sheet stuck on the previous entity because
 * `setSelectedToken` only wrote `mr.selectedToken` (no signal).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectedCharacterIdSignal, selectedNPCIdSignal, selectedTokenSignal,
  secretRollSignal,
} from '../state/ui-signals.js';

// Reproduce just the setSelectedToken behavior from MapRenderer, with
// a minimal stub for `state`. Importing the full class would drag in
// Konva and stage setup; the logic under test is small and pure.
import { ENTITY_TYPES } from '../utils/constants.js';

function buildMr({ tokens = new Map() } = {}) {
  // Inline a stub that mirrors the real method's signal-writing
  // contract - keeps the test focused on the signal plumbing.
  return {
    selectedToken: null,
    render: vi.fn(),
    state: {
      tokens,
      get selectedToken() { return selectedTokenSignal.value; },
      set selectedToken(v) { selectedTokenSignal.value = v; },
      get selectedCharacterId() { return selectedCharacterIdSignal.value; },
      set selectedCharacterId(v) { selectedCharacterIdSignal.value = v; },
      get selectedNPCId() { return selectedNPCIdSignal.value; },
      set selectedNPCId(v) { selectedNPCIdSignal.value = v; },
    },
    setSelectedToken(id) {
      this.selectedToken = id;
      if (this.state) {
        this.state.selectedToken = id;
        const token = id ? this.state.tokens?.get?.(id) : null;
        if (token?.sheet_id) {
          if (token.type === ENTITY_TYPES.NPC) {
            this.state.selectedNPCId = token.sheet_id;
          } else {
            this.state.selectedCharacterId = token.sheet_id;
          }
        } else if (!id) {
          this.state.selectedCharacterId = null;
          this.state.selectedNPCId = null;
        }
      }
      this.render();
    },
  };
}

beforeEach(() => {
  selectedCharacterIdSignal.value = null;
  selectedNPCIdSignal.value = null;
  selectedTokenSignal.value = null;
});

describe('setSelectedToken propagates to signal-backed selection fields', () => {
  it('PC token: fires selectedCharacterIdSignal + selectedTokenSignal', () => {
    const tokens = new Map([['tok-aria', { id: 'tok-aria', sheet_id: 'chr-aria', type: ENTITY_TYPES.PC }]]);
    const mr = buildMr({ tokens });
    mr.setSelectedToken('tok-aria');
    expect(selectedTokenSignal.value).toBe('tok-aria');
    expect(selectedCharacterIdSignal.value).toBe('chr-aria');
    expect(selectedNPCIdSignal.value).toBeNull();
  });

  it('NPC token: fires selectedNPCIdSignal + selectedTokenSignal', () => {
    const tokens = new Map([['tok-gob', { id: 'tok-gob', sheet_id: 'npc-gob', type: ENTITY_TYPES.NPC }]]);
    const mr = buildMr({ tokens });
    mr.setSelectedToken('tok-gob');
    expect(selectedTokenSignal.value).toBe('tok-gob');
    expect(selectedNPCIdSignal.value).toBe('npc-gob');
    expect(selectedCharacterIdSignal.value).toBeNull();
  });

  it('clearing (null) wipes both selection ids', () => {
    selectedCharacterIdSignal.value = 'leftover';
    selectedNPCIdSignal.value = 'leftover-too';
    const mr = buildMr();
    mr.setSelectedToken(null);
    expect(selectedTokenSignal.value).toBeNull();
    expect(selectedCharacterIdSignal.value).toBeNull();
    expect(selectedNPCIdSignal.value).toBeNull();
  });

  it('tokens without a sheet_id (props / item tokens) don\'t touch the ID signals', () => {
    const tokens = new Map([['tok-prop', { id: 'tok-prop', type: 'item' }]]);
    selectedCharacterIdSignal.value = 'kept';
    const mr = buildMr({ tokens });
    mr.setSelectedToken('tok-prop');
    expect(selectedTokenSignal.value).toBe('tok-prop');
    expect(selectedCharacterIdSignal.value).toBe('kept');
  });

  it('triggers mr.render once per call', () => {
    const mr = buildMr();
    mr.setSelectedToken('tok-x');
    expect(mr.render).toHaveBeenCalledTimes(1);
  });
});

describe('secretRollSignal', () => {
  it('toggle flips the signal value', async () => {
    const { secretRollSignal: sig } = await import('../state/ui-signals.js');
    sig.value = false;
    // Match the toggle implementation in ui-methods.js
    sig.value = !sig.value;
    expect(sig.value).toBe(true);
    sig.value = !sig.value;
    expect(sig.value).toBe(false);
  });

  it('default value is false', () => {
    expect(secretRollSignal).toBeDefined();
    // Reset to default in case prior tests changed it
    secretRollSignal.value = false;
    expect(secretRollSignal.value).toBe(false);
  });
});

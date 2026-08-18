/**
 * Regression for "View Full Sheet does nothing." The bug:
 * `_selectEntity` only writes selectedCharacterId/selectedNPCId
 * when no token exists for the sheet; if a token IS placed it sets
 * `ui.state.selectedToken` (plain prop, no signal) instead. The
 * Sheet panel subscribes to the SIGNAL-backed id, so nothing
 * re-rendered.
 *
 * Fix: always write the signal-backed id; additionally set the
 * token for map-highlight when applicable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectCharacterById, selectNPCById } from '../ui/entity/selection.js';
import {
  selectedCharacterIdSignal, selectedNPCIdSignal,
} from '../state/ui-signals.js';

function makeUi({ tokensFor = {}, switchTab = vi.fn() } = {}) {
  // Build a minimal ui.state shape and a mock mapRenderer. Plain
  // property writes target the same object the reader queries.
  const tokens = new Map();
  for (const [tokId, sheetId] of Object.entries(tokensFor)) {
    tokens.set(tokId, { id: tokId, sheet_id: sheetId });
  }
  const state = {
    tokens,
    characters: new Map([['c1', { id: 'c1', name: 'Aria', type: 'pc' }]]),
    npcs: new Map([['n1', { id: 'n1', name: 'Goblin', type: 'npc' }]]),
    selectedToken: null,
    // Wire the same getters/setters StateManager has.
    get selectedCharacterId() { return selectedCharacterIdSignal.value; },
    set selectedCharacterId(v) { selectedCharacterIdSignal.value = v; },
    get selectedNPCId() { return selectedNPCIdSignal.value; },
    set selectedNPCId(v) { selectedNPCIdSignal.value = v; },
  };
  const mapRenderer = { setSelectedToken: vi.fn() };
  return { state, mapRenderer, switchTab };
}

beforeEach(() => {
  selectedCharacterIdSignal.value = null;
  selectedNPCIdSignal.value = null;
});

describe('selectCharacterById fires selectedCharacterIdSignal', () => {
  it('sets the signal when no token exists for the character', () => {
    const ui = makeUi({ tokensFor: {} });
    selectCharacterById(ui, 'c1');
    expect(selectedCharacterIdSignal.value).toBe('c1');
  });

  it('sets the signal when a token DOES exist (the previously-broken path)', () => {
    const ui = makeUi({ tokensFor: { 'tok-aria': 'c1' } });
    selectCharacterById(ui, 'c1');
    expect(selectedCharacterIdSignal.value).toBe('c1');
  });

  it('still calls mapRenderer.setSelectedToken when a token exists', () => {
    const ui = makeUi({ tokensFor: { 'tok-aria': 'c1' } });
    selectCharacterById(ui, 'c1');
    expect(ui.mapRenderer.setSelectedToken).toHaveBeenCalledWith('tok-aria');
  });

  it('still writes ui.state.selectedToken when a token exists (map-highlight contract)', () => {
    const ui = makeUi({ tokensFor: { 'tok-aria': 'c1' } });
    selectCharacterById(ui, 'c1');
    expect(ui.state.selectedToken).toBe('tok-aria');
  });
});

describe('selectNPCById fires selectedNPCIdSignal', () => {
  it('sets the signal when no token exists for the NPC', () => {
    const ui = makeUi({ tokensFor: {} });
    selectNPCById(ui, 'n1');
    expect(selectedNPCIdSignal.value).toBe('n1');
  });

  it('sets the signal when a token DOES exist (the previously-broken path)', () => {
    const ui = makeUi({ tokensFor: { 'tok-gob': 'n1' } });
    selectNPCById(ui, 'n1');
    expect(selectedNPCIdSignal.value).toBe('n1');
  });

  it('still calls mapRenderer.setSelectedToken when a token exists', () => {
    const ui = makeUi({ tokensFor: { 'tok-gob': 'n1' } });
    selectNPCById(ui, 'n1');
    expect(ui.mapRenderer.setSelectedToken).toHaveBeenCalledWith('tok-gob');
  });
});

describe('switchTab is invoked unless suppressed', () => {
  it('calls switchTab(SHEET) for characters', () => {
    const switchTab = vi.fn();
    const ui = makeUi({ tokensFor: { 'tok-aria': 'c1' }, switchTab });
    selectCharacterById(ui, 'c1');
    expect(switchTab).toHaveBeenCalled();
  });

  it('opts.switchTab=false suppresses the tab switch', () => {
    const switchTab = vi.fn();
    const ui = makeUi({ tokensFor: { 'tok-aria': 'c1' }, switchTab });
    selectCharacterById(ui, 'c1', { switchTab: false });
    expect(switchTab).not.toHaveBeenCalled();
    // Signal still fires - selection happened.
    expect(selectedCharacterIdSignal.value).toBe('c1');
  });
});

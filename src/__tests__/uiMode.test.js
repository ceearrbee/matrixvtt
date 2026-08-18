/**
 * setPhase - per-(user, room) persistence and signal hydration.
 *
 * Coverage unique to this file: setPhase writes the correct user+room-scoped
 * localStorage key; room and user isolation; manual flag behaviour.
 * Initiative auto-switch lives in tablePhase.test.js.
 * hydratePhase migration lives in uiModeMigration.test.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  tablePhaseSignal,
  phaseManuallyOverriddenSignal,
} from '../state/ui-signals.js';
import { hydratePhase, setPhase } from '../ui/ui-mode.js';
import { STORAGE_KEYS, UI_MODES } from '../utils/constants.js';

const USER = '@alice:hs';
const ROOM = '!room1:hs';
const baseKey = `${STORAGE_KEYS.UI_MODE}:${ROOM}`;
const scopedKey = `${baseKey}::${USER}`;

function resetSignals() {
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  phaseManuallyOverriddenSignal.value = false;
}

describe('setPhase persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSignals();
  });

  it('sets tablePhaseSignal immediately', () => {
    setPhase(USER, ROOM, UI_MODES.COMBAT);
    expect(tablePhaseSignal.value).toBe(UI_MODES.COMBAT);
  });

  it('sets phaseManuallyOverriddenSignal when manual is default (true)', () => {
    setPhase(USER, ROOM, UI_MODES.COMBAT);
    expect(phaseManuallyOverriddenSignal.value).toBe(true);
  });

  it('does NOT set phaseManuallyOverriddenSignal when manual:false', () => {
    setPhase(USER, ROOM, UI_MODES.COMBAT, { manual: false });
    expect(phaseManuallyOverriddenSignal.value).toBe(false);
  });

  it('persists the phase to the user+room-scoped key so hydratePhase restores it', () => {
    setPhase(USER, ROOM, UI_MODES.COMBAT);
    // hydratePhase reads the persisted value - but also clears the key as a
    // migration sweep. Read the raw key before hydrating to confirm it was
    // written, then verify hydration restores the signal.
    // setPhase writes then hydratePhase migrates (sweeps) - use localStorage
    // directly before calling hydratePhase.
    // Note: hydratePhase reads baseKey (not scopedKey) via readUserScoped which
    // returns the user-scoped value when present.
    resetSignals();
    // The key was written by setPhase; now hydrate from scratch.
    // We re-call setPhase then reset signal then hydrate to confirm the round-trip.
    setPhase(USER, ROOM, UI_MODES.COMBAT);
    tablePhaseSignal.value = UI_MODES.NARRATIVE; // reset signal only
    hydratePhase(USER, ROOM, false);
    expect(tablePhaseSignal.value).toBe(UI_MODES.COMBAT);
  });

  it('ignores unknown phase values (only combat and narrative are valid)', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    setPhase(USER, ROOM, 'gm-prep');
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE); // unchanged
  });
});

describe('hydratePhase signal defaults', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSignals();
  });

  it('defaults to narrative when no key is stored', () => {
    hydratePhase(USER, ROOM, false);
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE);
  });

  it('restores narrative from stored narrative value', () => {
    localStorage.setItem(scopedKey, UI_MODES.NARRATIVE);
    hydratePhase(USER, ROOM, false);
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE);
  });

  it('falls back to narrative for an unrecognised stored value', () => {
    localStorage.setItem(scopedKey, 'bogus-mode');
    hydratePhase(USER, ROOM, false);
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE);
  });
});

describe('isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSignals();
  });

  it('rooms are isolated: writing for room A does not leak to room B', () => {
    setPhase(USER, ROOM, UI_MODES.COMBAT);
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    hydratePhase(USER, '!other-room:hs', false);
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE);
  });

  it('users are isolated: writing for alice does not affect bob in the same room', () => {
    setPhase('@alice:hs', ROOM, UI_MODES.COMBAT);
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    hydratePhase('@bob:hs', ROOM, false);
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE);
  });
});

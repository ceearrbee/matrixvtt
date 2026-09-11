/**
 * GM Prep axis - the second UI axis shipped with no setter, no control
 * and no key binding, so `gmPrepActiveSignal` was permanently false for
 * every new user and the PREP branch of mode-registry never ran.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { gmPrepActiveSignal } from '../state/ui-signals.js';
import { hydratePhase, setGmPrep } from '../ui/ui-mode.js';
import { STORAGE_KEY_PREFIXES } from '../utils/constants.js';

const USER = '@gm:hs';
const ROOM = '!room:hs';
const prepKey = `${STORAGE_KEY_PREFIXES.GM_PREP}${ROOM}::${USER}`;

describe('setGmPrep', () => {
  beforeEach(() => {
    localStorage.clear();
    gmPrepActiveSignal.value = false;
  });

  it('flips gmPrepActiveSignal both ways', () => {
    setGmPrep(USER, ROOM, true);
    expect(gmPrepActiveSignal.value).toBe(true);
    setGmPrep(USER, ROOM, false);
    expect(gmPrepActiveSignal.value).toBe(false);
  });

  it('persists per (user, room) so hydratePhase restores it', () => {
    setGmPrep(USER, ROOM, true);
    expect(localStorage.getItem(prepKey)).toBe('1');
    gmPrepActiveSignal.value = false;
    hydratePhase(USER, ROOM, true);
    expect(gmPrepActiveSignal.value).toBe(true);
  });

  it('keeps prep off for a player even with a stored value', () => {
    setGmPrep(USER, ROOM, true);
    hydratePhase(USER, ROOM, false);
    expect(gmPrepActiveSignal.value).toBe(false);
  });

  it('restores prep off when nothing is stored', () => {
    hydratePhase(USER, ROOM, true);
    expect(gmPrepActiveSignal.value).toBe(false);
  });

  it('updates the signal but writes nothing when the user is unknown', () => {
    setGmPrep(null, ROOM, true);
    expect(gmPrepActiveSignal.value).toBe(true);
    expect(localStorage.length).toBe(0);
  });
});

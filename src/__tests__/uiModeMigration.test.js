import { describe, it, expect, beforeEach } from 'vitest';
import { UI_MODES, STORAGE_KEYS } from '../utils/constants.js';
import { tablePhaseSignal, gmPrepActiveSignal } from '../state/ui-signals.js';
import { hydratePhase } from '../ui/ui-mode.js';
import { writeUserScoped, readUserScoped } from '../utils/user-storage.js';

const ROOM = '!r:s', USER = '@u:s';
const LEGACY_KEY = STORAGE_KEYS.UI_MODE; // 'vtt:ui-mode'

beforeEach(() => {
  localStorage.clear();
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  gmPrepActiveSignal.value = false;
});

describe('hydratePhase - legacy uiMode migration', () => {
  it("legacy 'combat' → phase combat", () => {
    writeUserScoped(`${LEGACY_KEY}:${ROOM}`, USER, 'combat');
    hydratePhase(USER, ROOM, /* isGM */ false);
    expect(tablePhaseSignal.value).toBe('combat');
    expect(gmPrepActiveSignal.value).toBe(false);
  });
  it("legacy 'gm-prep' + GM → phase narrative, prep active", () => {
    writeUserScoped(`${LEGACY_KEY}:${ROOM}`, USER, 'gm-prep');
    hydratePhase(USER, ROOM, /* isGM */ true);
    expect(tablePhaseSignal.value).toBe('narrative');
    expect(gmPrepActiveSignal.value).toBe(true);
  });
  it("legacy 'gm-prep' + non-GM → phase narrative, no prep", () => {
    writeUserScoped(`${LEGACY_KEY}:${ROOM}`, USER, 'gm-prep');
    hydratePhase(USER, ROOM, /* isGM */ false);
    expect(tablePhaseSignal.value).toBe('narrative');
    expect(gmPrepActiveSignal.value).toBe(false);
  });
  it('sweeps the legacy key after migrating', () => {
    writeUserScoped(`${LEGACY_KEY}:${ROOM}`, USER, 'combat');
    hydratePhase(USER, ROOM, false);
    expect(readUserScoped(`${LEGACY_KEY}:${ROOM}`, USER)).toBeFalsy();
  });
});

/**
 * bindPhaseToInitiative fires a sonner toast with an Undo action when
 * the combat-active rising edge auto-switches the local phase. The
 * Undo callback restores the prior phase and pins the manual-override
 * flag so subsequent combat starts in the same session do not
 * auto-switch.
 *
 * Sonner is mocked so we can assert on calls without mounting the
 * real Toaster.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const sonnerSpy = vi.fn();
vi.mock('sonner', () => ({
  toast: (msg, opts) => sonnerSpy(msg, opts),
}));

import { initiativeSignal } from '../state/signals.js';
import {
  tablePhaseSignal,
  phaseManuallyOverriddenSignal,
} from '../state/ui-signals.js';
import {
  hydratePhase,
  setPhase,
  bindPhaseToInitiative,
  unbindPhaseFromInitiative,
} from '../ui/ui-mode.js';
import { UI_MODES } from '../utils/constants.js';

const USER = '@alice:hs';
const ROOM = '!room:hs';

function resetSignals() {
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  phaseManuallyOverriddenSignal.value = false;
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
}

beforeEach(() => {
  sonnerSpy.mockClear();
  localStorage.clear();
  resetSignals();
});

afterEach(() => { unbindPhaseFromInitiative(); });

describe('ui-mode auto-switch toast', () => {
  it('fires a sonner toast on combat-active rising edge with an Undo action', () => {
    hydratePhase(USER, ROOM, false);
    bindPhaseToInitiative(USER, ROOM);
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [{ id: 't1' }] };
    expect(sonnerSpy).toHaveBeenCalledTimes(1);
    const [msg, opts] = sonnerSpy.mock.calls[0];
    expect(msg).toMatch(/combat phase/i);
    expect(opts?.action?.label).toBe('Undo');
    expect(typeof opts?.action?.onClick).toBe('function');
  });

  it('Undo restores the prior phase AND pins the manual-override flag', () => {
    hydratePhase(USER, ROOM, false);
    bindPhaseToInitiative(USER, ROOM);
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [{ id: 't1' }] };
    expect(tablePhaseSignal.value).toBe(UI_MODES.COMBAT);
    const undo = sonnerSpy.mock.calls[0][1].action.onClick;
    undo();
    expect(tablePhaseSignal.value).toBe(UI_MODES.NARRATIVE);
    expect(phaseManuallyOverriddenSignal.value).toBe(true);
  });

  it('does NOT toast when the user has manually overridden the phase', () => {
    setPhase(USER, ROOM, UI_MODES.NARRATIVE, { manual: true });
    bindPhaseToInitiative(USER, ROOM);
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [{ id: 't1' }] };
    expect(sonnerSpy).not.toHaveBeenCalled();
  });

  it('does NOT toast on the falling edge (combat ending)', () => {
    hydratePhase(USER, ROOM, false);
    bindPhaseToInitiative(USER, ROOM);
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [{ id: 't1' }] };
    sonnerSpy.mockClear();
    initiativeSignal.value = { active: false, round: 2, current_index: 0, order: [] };
    expect(sonnerSpy).not.toHaveBeenCalled();
  });

  it('does NOT toast if already in Combat phase when the edge fires', () => {
    setPhase(USER, ROOM, UI_MODES.COMBAT, { manual: false });
    sonnerSpy.mockClear();
    bindPhaseToInitiative(USER, ROOM);
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [{ id: 't1' }] };
    expect(sonnerSpy).not.toHaveBeenCalled();
  });
});

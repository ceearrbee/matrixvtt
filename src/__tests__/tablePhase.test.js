import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UI_MODES } from '../utils/constants.js';
import { tablePhaseSignal, phaseManuallyOverriddenSignal } from '../state/ui-signals.js';
import { initiativeSignal } from '../state/signals.js';
import { bindPhaseToInitiative, unbindPhaseFromInitiative, setPhase } from '../ui/ui-mode.js';

beforeEach(() => {
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  phaseManuallyOverriddenSignal.value = false;
  initiativeSignal.value = { active: false };
});
afterEach(() => unbindPhaseFromInitiative());

describe('bindPhaseToInitiative', () => {
  it('switches to combat when initiative becomes active, reverts when it ends', () => {
    bindPhaseToInitiative(null, null);
    initiativeSignal.value = { active: true };
    expect(tablePhaseSignal.value).toBe('combat');
    initiativeSignal.value = { active: false };
    expect(tablePhaseSignal.value).toBe('narrative');
  });
  it('does not auto-switch once the user has manually overridden', () => {
    bindPhaseToInitiative(null, null);
    setPhase(null, null, UI_MODES.NARRATIVE, { manual: true });
    initiativeSignal.value = { active: true };
    expect(tablePhaseSignal.value).toBe('narrative');
  });
});

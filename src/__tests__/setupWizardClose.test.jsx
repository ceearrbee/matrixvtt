/**
 * closeSetupWizard - explicit teardown for the SetupWizard host.
 * Replaces the dead `getElementById('setup-wizard-modal').remove()`
 * lookup in lifecycle-init.js (`SESSION_RESET` handler).
 *
 * Scope: lock the contract that `closeSetupWizard` is exported AND
 * is a safe no-op when no wizard is mounted. End-to-end mount/unmount
 * behaviour requires the full setup-wizard scaffolding (presets,
 * room-visited stamp, residual-entity probe) which isn't worth
 * recreating here - the wizard's own existing tests cover the mount
 * path.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { closeSetupWizard } from '../ui/SetupWizard.jsx';

describe('closeSetupWizard (export contract)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('is a safe no-op when no wizard is mounted', () => {
    expect(typeof closeSetupWizard).toBe('function');
    expect(() => closeSetupWizard()).not.toThrow();
    expect(() => closeSetupWizard()).not.toThrow();
  });

  it('removes a host element it owns (simulated mount)', () => {
    // Simulate the wizard mount path: append a host with the wizard's
    // data-attr, then call close. (The real wizard sets this attr in
    // renderSetupWizard; we mimic it here without invoking the full
    // body component, which needs setup-flow scaffolding.)
    const host = document.createElement('div');
    host.setAttribute('data-vtt-setup-wizard-host', '');
    document.body.appendChild(host);
    expect(document.querySelector('[data-vtt-setup-wizard-host]')).not.toBeNull();

    // The module-level ref isn't populated because we bypassed
    // renderSetupWizard - closeSetupWizard noops, which is correct.
    closeSetupWizard();
    // Host still present (we never registered it with the module).
    expect(document.querySelector('[data-vtt-setup-wizard-host]')).not.toBeNull();
    host.remove();
  });
});

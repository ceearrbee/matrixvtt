/**
 * SetupWizard escape hatch - a user who reached the wizard accidentally
 * (e.g. a stale _forceWizard flake) must always have a non-destructive
 * way out, in BOTH runtime modes. Previously the only exit in widget
 * mode was Blank Campaign (which destroys room state), and ESC/backdrop
 * dispatched LEAVE_ROOM - kicking the user out of the room entirely.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import { renderSetupWizard, closeSetupWizard } from '../ui/SetupWizard.jsx';
import { VTT_EVENTS } from '../utils/constants.js';

class FakeState {
  static getGameSystemPresets() {
    return { dnd5e: { name: 'D&D 5e' } };
  }
}

function makeUi({ isAppClient = false } = {}) {
  const state = Object.assign(new FakeState(), {
    tokens: new Map(), characters: new Map(), npcs: new Map(),
    items: new Map(), spells: new Map(), handouts: new Map(),
    tables: new Map(), maps: new Map(), walls: new Map(),
    templates: new Map(), pins: new Map(), lights: new Map(),
    pages: new Map(), drawings: [],
  });
  return {
    state,
    _forceWizard: true,
    widgetManager: { userId: '@u:hs', roomId: '!r:hs', isAppClient },
    showPlayerWelcome: vi.fn(),
    isTutorialCompleted: () => true,
  };
}

function collectLeaves() {
  const events = [];
  const handler = () => events.push(true);
  window.addEventListener(VTT_EVENTS.LEAVE_ROOM, handler);
  return { events, cleanup: () => window.removeEventListener(VTT_EVENTS.LEAVE_ROOM, handler) };
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { closeSetupWizard(); });

describe('SetupWizard escape hatch', () => {
  it('renders "Just open the room" in widget mode on an empty room', () => {
    renderSetupWizard(makeUi({ isAppClient: false }));
    expect(document.querySelector('[data-wizard-open-room]')).not.toBeNull();
  });

  it('clicking it closes the wizard, clears _forceWizard, and never leaves the room', () => {
    const ui = makeUi();
    const leaves = collectLeaves();
    renderSetupWizard(ui);

    fireEvent.click(document.querySelector('[data-wizard-open-room]'));

    leaves.cleanup();
    expect(leaves.events).toHaveLength(0);
    expect(ui._forceWizard).toBe(false);
    expect(document.querySelector('[data-vtt-setup-wizard-host]')).toBeNull();
  });

  it('ESC closes safely instead of dispatching LEAVE_ROOM', () => {
    const ui = makeUi();
    const leaves = collectLeaves();
    renderSetupWizard(ui);

    fireEvent.keyDown(document.querySelector('.modal-overlay'), { key: 'Escape' });

    leaves.cleanup();
    expect(leaves.events).toHaveLength(0);
    expect(ui._forceWizard).toBe(false);
    expect(document.querySelector('[data-vtt-setup-wizard-host]')).toBeNull();
  });

  it('keeps the explicit ← Back (leave) button standalone-only', () => {
    renderSetupWizard(makeUi({ isAppClient: false }));
    expect(document.querySelector('[data-wizard-back]')).toBeNull();
    closeSetupWizard();

    renderSetupWizard(makeUi({ isAppClient: true }));
    expect(document.querySelector('[data-wizard-back]')).not.toBeNull();
  });
});

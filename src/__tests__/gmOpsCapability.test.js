/**
 * gmOpsCapability.test.js - locks in the narrow-capability contract used
 * by the GM-tab sub-panels for fog / bulk actions / NPC-template flows.
 *
 * The fog and combat panels accept a hand-built `gm` ops object; their
 * buttons must route through that object rather than calling `ui.toggleFog`
 * directly. If someone reintroduces `ui.toggleFog()` here, this test fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { FogPanel } from '../ui/gm/panels/FogPanel.jsx';
import { CombatPanel } from '../ui/gm/panels/CombatPanel.jsx';
import { fogSignal, activeMapIdSignal } from '../state/signals.js';

vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

function makeStubUI() {
  return {
    state: { isGM: () => true, settings: { environment: {} } },
    rollInitiative: vi.fn(), prevTurn: vi.fn(), nextTurn: vi.fn(), endCombat: vi.fn(),
  };
}

function findButtonByText(host, text) {
  return [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
}

describe('GM panels consume a narrow GM ops capability', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    fogSignal.value = new Map();
    activeMapIdSignal.value = null;
  });
  afterEach(() => { render(null, host); host.remove(); vi.clearAllMocks(); });

  it('Toggle Fog routes through gm.toggleFog', () => {
    const gm = {
      toggleFog: vi.fn(), revealAllFog: vi.fn(), hideAllFog: vi.fn(),
    };
    render(h(FogPanel, { ui: makeStubUI(), gm }), host);
    // Default fog mode is HIDDEN, so the "🌫 Fog On" label renders.
    findButtonByText(host, '🌫 Fog On').click();
    expect(gm.toggleFog).toHaveBeenCalledTimes(1);
  });

  it('Heal All routes through gm.healAll', () => {
    const gm = { healAll: vi.fn(), clearAllConditions: vi.fn() };
    render(h(CombatPanel, { ui: makeStubUI(), gm }), host);
    findButtonByText(host, 'Heal All').click();
    expect(gm.healAll).toHaveBeenCalledTimes(1);
  });
});

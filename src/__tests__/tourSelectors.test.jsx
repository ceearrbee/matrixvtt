/**
 * Every onboarding-tour step must target an element that actually
 * exists in the mounted Almanac shell. The tour silently drops steps
 * whose selector is missing, so a refactor that renames a class can
 * quietly gut the tour; this suite is the regression gate.
 *
 * The shell mounts with the REAL Header, MapStrip, DiceBar,
 * RightCompanion, and LeftIndex, because those host the tour targets.
 * Only surfaces without tour anchors are stubbed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';

vi.mock('../ui/useKeyboardShortcuts.js', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('../ui/LogContainer.jsx', () => ({ LogContainer: () => h('div', { 'data-stub': 'log' }) }));
vi.mock('../ui/CombatInitiativeStrip.jsx', () => ({ CombatInitiativeStrip: () => null }));
vi.mock('../ui/InitiativeBar.jsx', () => ({ InitiativeBar: () => null }));
vi.mock('../ui/MobileTabBar.jsx', () => ({ MobileTabBar: () => null }));
vi.mock('../ui/sync/DebugBar.jsx', () => ({ DebugBar: () => null }));
vi.mock('../ui/FloatingDoc.jsx', () => ({ FloatingDocs: () => null }));
vi.mock('../ui/LegacyChatPopups.jsx', () => ({ LegacyChatPopups: () => null }));
vi.mock('../ui/SuggestedModeBanner.jsx', () => ({ SuggestedModeBanner: () => null }));

const { App } = await import('../ui/App.jsx');
const { buildTourSteps } = await import('../ui/onboarding-tour.js');

// Steps that only resolve once campaign content exists (entity cards
// render inside a tab body that mounts on demand). Every step listed
// here must say why.
const CONDITIONAL_SELECTORS = new Set([
  // Character/NPC cards render only when entities exist and their tab
  // or drawer is open; the tour legitimately skips it in an empty room.
  '.char-list, [data-character-card], [data-npc-card]',
]);

function makeUi({ isGM = true } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      tokens: new Map(),
      characters: new Map(),
      npcs: new Map(),
      items: new Map(),
      spells: new Map(),
      maps: new Map(),
      pages: new Map(),
      handouts: new Map(),
      settings: { name: 'r', system: 'dnd5e', systemConfig: {}, gm_user_ids: isGM ? ['@me:m'] : [] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
      isTokenVisibleToPlayer: () => true,
      getCurrentCharacter: () => null,
      getCurrentCharacterId: () => null,
      canEditEntity: () => isGM,
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: false },
    _debugMode: false,
    _toast: () => {},
  });
}

function mountShell({ isGM }) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(h(App, { ui: makeUi({ isGM }) }), host);
  return host;
}

describe('onboarding tour selectors resolve in the live shell', () => {
  let host;
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { if (host) { render(null, host); host.remove(); host = null; } });

  it('every GM step targets a mounted element', () => {
    host = mountShell({ isGM: true });
    for (const step of buildTourSteps(true)) {
      if (!step.element || CONDITIONAL_SELECTORS.has(step.element)) continue;
      expect(
        host.querySelector(step.element),
        `tour step "${step.popover.title}" targets missing selector: ${step.element}`
      ).not.toBeNull();
    }
  });

  it('every player step targets a mounted element', () => {
    host = mountShell({ isGM: false });
    for (const step of buildTourSteps(false)) {
      if (!step.element || CONDITIONAL_SELECTORS.has(step.element)) continue;
      expect(
        host.querySelector(step.element),
        `tour step "${step.popover.title}" targets missing selector: ${step.element}`
      ).not.toBeNull();
    }
  });

  it('conditional selectors stay in sync with the step list', () => {
    const elements = new Set(buildTourSteps(true).map((s) => s.element).filter(Boolean));
    for (const sel of CONDITIONAL_SELECTORS) {
      expect(elements.has(sel), `stale conditional entry: ${sel}`).toBe(true);
    }
  });
});

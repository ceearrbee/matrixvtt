/**
 * InitiativeBar visibility is mount-side, not CSS.
 *
 * In Combat mode the CombatSidebar (right rail) owns the turn-order
 * presentation, so App.jsx unmounts the chat-column InitiativeBar to
 * avoid showing the same data twice. In every other mode the bar
 * mounts as before (GMs see the "Start combat" affordance in
 * Exploration, players see only an active fight).
 *
 * The previous `.shell:not([data-ui-mode="combat"]) .initiative-panel
 * { display: none }` CSS rule has been retired in favor of this
 * mount-side gate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';

// dnd-kit is mocked in many existing initiative tests; replicate that
// here so InitiativeBar can render without a real DOM-drag harness.
vi.mock('../ui/useKeyboardShortcuts.js', () => ({ useKeyboardShortcuts: () => {} }));
vi.mock('../ui/Header.jsx', () => ({ Header: () => h('div', { 'data-stub': 'header' }) }));
vi.mock('../ui/DiceBar.jsx', () => ({ DiceBar: () => h('div', { 'data-stub': 'dice' }) }));
vi.mock('../ui/RightCompanion.jsx', () => ({ RightCompanion: () => h('div', { 'data-stub': 'companion' }) }));
vi.mock('../ui/LeftIndex.jsx', () => ({ LeftIndex: () => h('div', { 'data-stub': 'left-index' }) }));
vi.mock('../ui/SuggestedModeBanner.jsx', () => ({ SuggestedModeBanner: () => null }));
vi.mock('../ui/MapStrip.jsx', () => ({ MapStrip: () => h('div', { 'data-stub': 'map' }), TOOLS: [], GM_TOOLS: [] }));
vi.mock('../ui/LogContainer.jsx', () => ({ LogContainer: () => h('div', { 'data-stub': 'log' }) }));
vi.mock('../ui/ChannelsRail.jsx', () => ({ ChannelsRail: () => h('div', { 'data-stub': 'channels' }) }));
vi.mock('../ui/sync/DebugBar.jsx', () => ({ DebugBar: () => h('div', { 'data-stub': 'debug' }) }));
vi.mock('../ui/FloatingDoc.jsx', () => ({ FloatingDocs: () => h('div', { 'data-stub': 'docs' }) }));
// dnd-kit gets stubbed so InitiativeBar can render without a real
// drag harness.
vi.mock('@dnd-kit/core', () => ({
  DndContext: (props) => h('div', null, props.children),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  PointerSensor: {},
  KeyboardSensor: {},
  closestCenter: vi.fn(),
}));
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(),
    transform: null, transition: undefined, isDragging: false,
  })),
  SortableContext: (props) => h('div', null, props.children),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
}));

const { App } = await import('../ui/App.jsx');
const { tablePhaseSignal } = await import('../state/ui-signals.js');
const { initiativeSignal } = await import('../state/signals.js');
const { UI_MODES } = await import('../utils/constants.js');

function makeUi({ isGM = false, combatActive = false } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      tokens: new Map(),
      settings: { name: 'r', systemConfig: {}, gm_user_ids: isGM ? ['@me:m'] : [] },
      initiative: combatActive
        ? { active: true, round: 1, current_index: 0, order: [] }
        : { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
      isTokenVisibleToPlayer: () => true,
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: false },
    _debugMode: false,
    _isMyCombatTurn: () => false,
    rollInitiative: vi.fn(),
    endCombat: vi.fn(),
    reorderInitiative: vi.fn(),
  });
}

describe('InitiativeBar mount gating', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => { render(null, host); host.remove(); });

  it('Combat mode unmounts the chat-column InitiativeBar', () => {
    tablePhaseSignal.value = UI_MODES.COMBAT;
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [] };
    render(h(App, { ui: makeUi({ combatActive: true, isGM: true }) }), host);
    expect(host.querySelector('.initiative-panel')).toBeNull();
  });

  it('Exploration mode (GM, no active combat) mounts the InitiativeBar "Start combat" affordance', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    render(h(App, { ui: makeUi({ isGM: true }) }), host);
    expect(host.querySelector('.initiative-panel--inactive')).not.toBeNull();
  });

  it('Narrative mode also mounts the bar (visible per mount logic)', () => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [] };
    render(h(App, { ui: makeUi({ combatActive: true, isGM: true }) }), host);
    expect(host.querySelector('.initiative-panel')).not.toBeNull();
  });
});

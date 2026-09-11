/**
 * First-paint control budget.
 *
 * The shell's own critique scored "everyone sees everything: ~40
 * controls at first paint" as the top density problem, and PRODUCT.md
 * principle 5 makes density mode-gated. This gate counts the
 * interactive controls a freshly-entered room renders and fails when
 * that grows, in the style of the inline-style and emoji ratchets.
 *
 * Counting rules, so the number means something:
 *  - buttons, links, form fields and ARIA widget roles count;
 *  - screen-reader-only and aria-hidden nodes do not, since nobody
 *    sees them;
 *  - anything inside a closed <details> does not - that is the whole
 *    point of a disclosure - but its summary does;
 *  - phone-only chrome (the bottom tab bar, the drawer toggles) does
 *    not count against the desktop budget, and vice versa.
 *
 * Lower these ceilings as later phases land. Never raise one without
 * saying why in the commit message.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';

vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...(await importOriginal()),
  DndContext: (props) => h('div', null, props.children),
  useSensor: vi.fn(), useSensors: vi.fn(() => []),
  PointerSensor: {}, KeyboardSensor: {},
}));
vi.mock('@dnd-kit/sortable', async (importOriginal) => ({
  ...(await importOriginal()),
  useSortable: vi.fn(() => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(),
    transform: null, transition: undefined, isDragging: false,
  })),
  SortableContext: (props) => h('div', null, props.children),
}));

const { mountApp } = await import('../ui/App.jsx');
const { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal, layoutModeSignal } =
  await import('../state/ui-signals.js');
const { UI_MODES, TOOL_GROUPS, LAYOUT_MODES } = await import('../utils/constants.js');

// A GM not in Prep, and a player: the two first-paint states the
// budget is about. Both land on a blank campaign, the worst case.
const CEILING = { gm: 43, player: 37 };

function makeUi(isGM) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      tokens: new Map(), maps: new Map(), characters: new Map(), npcs: new Map(),
      items: new Map(), spells: new Map(), handouts: new Map(), tables: new Map(),
      pages: new Map(), pins: new Map(), walls: new Map(), lights: new Map(),
      templates: new Map(), drawings: [], roomMembers: [{ userId: '@me:m' }],
      settings: { name: 'r', systemConfig: {}, gm_user_ids: isGM ? ['@me:m'] : [] },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      fog: { mode: null, revealed: [] },
      activeMapId: null, powerLevels: null, damageLog: [], pendingKnocks: [],
      getCurrentCharacter: () => null,
      isTokenVisibleToPlayer: () => true,
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m', canLeave: true, isAppClient: true },
    _isMyCombatTurn: () => false,
    _currentTab: 'sheet',
    chat: { announcements: {} },
    _latestDiceResult: '',
  });
}

const CONTROLS = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="radio"]';
const PHONE_ONLY = '.mobile-tab-bar, .shell__mobile-toggle';

function countControls(host) {
  return [...host.querySelectorAll(CONTROLS)].filter((el) => {
    if (el.closest('.sr-only, [hidden], [aria-hidden="true"]')) return false;
    if (el.closest(PHONE_ONLY) || el.matches(PHONE_ONLY)) return false;
    const details = el.closest('details');
    if (details && !details.open && !el.closest('summary')) return false;
    return true;
  });
}

describe('first-paint control budget', () => {
  let host;
  beforeEach(() => {
    localStorage.clear();
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = false;
    activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
    layoutModeSignal.value = LAYOUT_MODES.TEXT;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => { host.remove(); });

  for (const [role, isGM] of [['gm', true], ['player', false]]) {
    it(`a ${role} sees at most ${CEILING[role]} controls at first paint`, () => {
      mountApp(host, makeUi(isGM));
      const controls = countControls(host);
      const names = controls.map((el) => el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName);
      expect(controls.length, `over budget:\n${names.join('\n')}`).toBeLessThanOrEqual(CEILING[role]);
    });
  }

  function countFresh(isGM) {
    const scratch = document.createElement('div');
    document.body.appendChild(scratch);
    mountApp(scratch, makeUi(isGM));
    const n = countControls(scratch).length;
    scratch.remove();
    return n;
  }

  it('a player never sees more than a GM', () => {
    expect(countFresh(false)).toBeLessThanOrEqual(countFresh(true));
  });

  // Counting controls missed the first shape of the next-steps panel:
  // five controls, but a hint sentence and a button row each, ~a quarter
  // of the shell height sat on the map. Persistent chrome is measured by
  // the rows it costs as well as the controls it carries.
  it('spends at most one row of the shell on the first-run surface', () => {
    mountApp(host, makeUi(true));
    const firstRun = host.querySelector('.next-steps');
    expect(firstRun).not.toBeNull();
    for (const blockTag of ['p', 'ul', 'ol', 'li', 'section', 'div']) {
      expect(firstRun.querySelector(blockTag), `${blockTag} inside the first-run surface`).toBeNull();
    }
  });

  it('turning Prep on is what adds the GM authoring controls', () => {
    const resting = countFresh(true);
    gmPrepActiveSignal.value = true;
    expect(countFresh(true)).toBeGreaterThan(resting);
  });
});


/**
 * Focus mode puts the table in front of the chrome.
 *
 * Both rails go; the header, map, chat and composer stay. It is
 * reachable by one key and one palette command and by nothing else on
 * screen, because the first-paint budget counts every button and the
 * ceilings are claimed. That makes the way out the thing to prove: a
 * mode you can enter and not leave is the dead end the deadEndExits
 * gate exists to stop.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { h } from 'preact';

// Same mocks the first-paint budget uses: dnd-kit's real hooks throw
// outside a component when the tree is mounted directly.
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
const { focusModeSignal } = await import('../state/ui-signals.js');
const { setFocusMode, hydrateFocusMode } = await import('../ui/ui-mode.js');
const { buildPaletteCommands } = await import('../ui/palette-commands.js');

const read = (rel) => readFileSync(join(process.cwd(), rel), 'utf8');

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  focusModeSignal.value = false;
});

describe('the focus mode flag', () => {
  it('starts off', () => {
    expect(focusModeSignal.value).toBe(false);
  });

  it('round-trips per user and room', () => {
    setFocusMode('@a:hs', '!r:hs', true);
    focusModeSignal.value = false;
    hydrateFocusMode('@a:hs', '!r:hs');
    expect(focusModeSignal.value).toBe(true);
  });

  it('does not follow one account to another', () => {
    setFocusMode('@a:hs', '!r:hs', true);
    hydrateFocusMode('@b:hs', '!r:hs');
    expect(focusModeSignal.value).toBe(false);
  });

  it('does not follow one campaign to another', () => {
    setFocusMode('@a:hs', '!one:hs', true);
    hydrateFocusMode('@a:hs', '!two:hs');
    expect(focusModeSignal.value).toBe(false);
  });
});

describe('the shell reflects it', () => {
  it('marks the shell so the stylesheet can collapse the rails', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    focusModeSignal.value = true;
    mountApp(host, makeUi());
    expect(host.querySelector('.shell').getAttribute('data-focus')).toBe('on');
  });

  it('leaves the mark off when the mode is off', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    mountApp(host, makeUi());
    expect(host.querySelector('.shell').getAttribute('data-focus')).toBeNull();
  });

  it('collapses both rail tracks in the mode block, not elsewhere', () => {
    const css = read('src/styles.css');
    const block = css.slice(css.indexOf('UI MODE RULES BEGIN'), css.indexOf('UI MODE RULES END'));
    expect(block).toContain('[data-focus="on"]');
  });
});

describe('the way in and the way out', () => {
  const ui = /** @type {any} */ ({ state: { isGM: () => true, initiative: {} } });

  it('is a palette command, so it is reachable from anywhere', () => {
    const ids = buildPaletteCommands(ui, { isGM: true, combatActive: false }).map((c) => c.id);
    expect(ids).toContain('focus-mode');
  });

  it('names the exit while the mode is on, not the entrance', () => {
    focusModeSignal.value = true;
    const cmd = buildPaletteCommands(ui, { isGM: true, combatActive: false })
      .find((c) => c.id === 'focus-mode');
    expect(cmd.label.toLowerCase()).toMatch(/leave|exit|show/);
  });

  it('is offered to a player too, since chrome is not a GM concern', () => {
    const ids = buildPaletteCommands(ui, { isGM: false, combatActive: false }).map((c) => c.id);
    expect(ids).toContain('focus-mode');
  });

  it('is listed in the keyboard help, so the key is discoverable', () => {
    expect(read('src/ui/keyboard-help.js')).toMatch(/focus/i);
  });

  it('adds no control to first paint, because the budget has no headroom', () => {
    expect(read('src/ui/Header.jsx')).not.toMatch(/focus-mode-btn/);
  });
});

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      tokens: new Map(), maps: new Map(), characters: new Map(), npcs: new Map(),
      items: new Map(), spells: new Map(), handouts: new Map(), tables: new Map(),
      pages: new Map(), pins: new Map(), walls: new Map(), lights: new Map(),
      templates: new Map(), drawings: [], roomMembers: [{ userId: '@me:m' }],
      settings: { name: 'r', systemConfig: {}, gm_user_ids: ['@me:m'] },
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

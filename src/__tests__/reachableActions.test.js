/**
 * Eight actions lived only behind a right-click on the map: nothing on
 * screen said they existed. Two of them had no other path at all - a
 * placed light could never be removed, because `removeLight` had no UI
 * caller anywhere, and the erase tool skipped lights while handling
 * drawings, walls and templates.
 *
 * Token verbs answer to the palette now that it is the way in, pin
 * placement joins walls and lights in the Scene group, and the erase
 * tool covers everything the toolbar can draw. Right-click stays as
 * the accelerator rather than the only path, so its labels drop the
 * decorative emoji the rest of the chrome gave up.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { buildPaletteCommands } from '../ui/palette-commands.js';
import { lightAt } from '../map/hit-test.js';
import { placePinAt } from '../map/input/tools.js';
import { MapStrip } from '../ui/MapStrip.jsx';
import { showTokenContextMenu, showMapContextMenu } from '../map/context-menus.js';
import { tablePhaseSignal, gmPrepActiveSignal, activeToolGroupSignal } from '../state/ui-signals.js';
import { UI_MODES, TOOL_GROUPS } from '../utils/constants.js';

const ui = () => /** @type {any} */ ({
  duplicateToken: vi.fn(), addTokenToInitiative: vi.fn(), removeFromInitiative: vi.fn(),
  mapRenderer: { _startFacingMode: vi.fn(), _clearFacing: vi.fn(), toggleTokenHPVisibility: vi.fn() },
});

const ids = (opts) => buildPaletteCommands(ui(), opts).map((c) => c.id);

const GM = { isGM: true, combatActive: false };

describe('token verbs are reachable without a right-click', () => {
  it('offers none of them when nothing is selected', () => {
    const none = ids({ ...GM, selectedToken: null });
    for (const id of ['token-facing', 'token-duplicate', 'token-initiative']) {
      expect(none, id).not.toContain(id);
    }
  });

  it('offers them against the selected token', () => {
    const some = ids({ ...GM, selectedToken: { id: 't1', name: 'Goblin', type: 'npc' } });
    for (const id of ['token-facing', 'token-duplicate', 'token-initiative', 'token-hp-visibility']) {
      expect(some, id).toContain(id);
    }
  });

  it('names the token so the command reads as a sentence', () => {
    const cmd = buildPaletteCommands(ui(), { ...GM, selectedToken: { id: 't1', name: 'Goblin' } })
      .find((c) => c.id === 'token-duplicate');
    expect(cmd.label).toMatch(/Goblin/);
  });

  it('offers HP visibility only for an NPC, whose HP players might not see', () => {
    const pc = ids({ ...GM, selectedToken: { id: 't1', name: 'Aria', type: 'pc' } });
    expect(pc).not.toContain('token-hp-visibility');
  });

  it('keeps them away from a player', () => {
    const player = ids({ isGM: false, combatActive: false, selectedToken: { id: 't1', name: 'X' } });
    expect(player).not.toContain('token-duplicate');
  });

  it('runs the verb through the map renderer the context menu already used', () => {
    const u = ui();
    buildPaletteCommands(u, { ...GM, selectedToken: { id: 't1', name: 'Goblin' } })
      .find((c) => c.id === 'token-duplicate').run();
    expect(u.duplicateToken).toHaveBeenCalledWith('t1');
  });
});

describe('a light can be removed', () => {
  const cellPx = 40;
  const light = { id: 'l1', x: 100, y: 100, radius_px: 120 };

  it('hit-tests a click inside the light against its source, not its glow', () => {
    expect(lightAt({ lights: new Map([['l1', light]]), x: 104, y: 96, cellPx })).toBe(light);
  });

  it('misses a click out in the lit area rather than the lamp itself', () => {
    expect(lightAt({ lights: new Map([['l1', light]]), x: 180, y: 100, cellPx })).toBeNull();
  });

  it('survives an empty or missing collection', () => {
    expect(lightAt({ lights: new Map(), x: 0, y: 0, cellPx })).toBeNull();
    expect(lightAt({ lights: null, x: 0, y: 0, cellPx })).toBeNull();
  });
});

describe('the pin tool has a home in the Scene group', () => {
  let host;
  beforeEach(() => {
    tablePhaseSignal.value = UI_MODES.NARRATIVE;
    gmPrepActiveSignal.value = true;
    activeToolGroupSignal.value = TOOL_GROUPS.GM;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host); host.remove();
    activeToolGroupSignal.value = TOOL_GROUPS.NAVIGATION;
    gmPrepActiveSignal.value = false;
  });

  it('renders alongside walls, lights and templates', () => {
    const u = /** @type {any} */ ({
      state: {
        isGM: () => true, tokens: new Map(), maps: new Map(),
        settings: { name: 'r', systemConfig: {}, gm_user_ids: ['@me:m'] },
        initiative: { active: false, round: 0, current_index: 0, order: [] },
        fog: { mode: null, revealed: [] },
      },
      widgetManager: { userId: '@me:m', roomId: '!r:m' },
    });
    render(h(MapStrip, { ui: u }), host);
    expect(host.querySelector('.dtb-btn[data-tool="pin"]')).not.toBeNull();
  });

  it('opens the pin form at the clicked cell', () => {
    const mr = /** @type {any} */ ({
      state: { isGM: () => true, map: { id: 'm', cell_px: 40, width_cells: 20, height_cells: 20 } },
      showPinForm: vi.fn(),
    });
    placePinAt(mr, 85, 45);
    expect(mr.showPinForm).toHaveBeenCalledWith(2, 1);
  });

  it('stays shut to a player', () => {
    const mr = /** @type {any} */ ({
      state: { isGM: () => false, map: { id: 'm', cell_px: 40, width_cells: 20, height_cells: 20 } },
      showPinForm: vi.fn(),
    });
    placePinAt(mr, 85, 45);
    expect(mr.showPinForm).not.toHaveBeenCalled();
  });
});

describe('right-click labels read as words, not glyphs', () => {
  const hasEmoji = (text) => [...text].some((ch) => {
    const cp = ch.codePointAt(0);
    return (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x2b00 && cp <= 0x2bff);
  });
  const mr = () => /** @type {any} */ ({
    state: {
      isGM: () => true,
      initiative: { order: [] },
      tokens: new Map([['t1', { id: 't1', name: 'Goblin', type: 'npc', show_hp: true }]]),
    },
  });
  afterEach(() => { document.querySelectorAll('.context-menu').forEach((m) => m.remove()); });

  it('the token menu carries no emoji', () => {
    const menu = showTokenContextMenu(mr(), { id: 't1', name: 'Goblin' }, 0, 0, /** @type {any} */ ({}));
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent);
    expect(labels.filter(hasEmoji)).toEqual([]);
  });

  it('the map menu carries no emoji', () => {
    const menu = showMapContextMenu(mr(), 0, 0, 1, 1);
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent);
    expect(labels.filter(hasEmoji)).toEqual([]);
  });
});

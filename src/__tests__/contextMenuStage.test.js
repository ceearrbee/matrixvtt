/**
 * Right-click on the map should:
 *  - empty cell (GM)        → map context menu (Add Token, Toggle Fog Cell)
 *  - empty cell (non-GM)    → no menu (browser context menu still suppressed)
 *  - on a token (any role)  → token context menu (View Sheet at minimum)
 *
 * Regression: the Konva phase 6/7 migration replaced the menu builder
 * with a direct call to showAddTokenDialog. This pins the restored
 * dispatch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showMapContextMenu, showTokenContextMenu } from '../map/context-menus.js';

function makeMr({ isGM = true, tokens = new Map() } = {}) {
  const mr = {
    state: {
      isGM: () => isGM,
      tokens,
      initiative: { active: false, order: [] },
      widgetManager: { userId: '@me:hs' },
      map: { cell_px: 40 },
    },
    showAddTokenDialog: vi.fn(),
    _toggleSingleFogCell: vi.fn(),
    showDamageDialog: vi.fn(),
    showConditionDialog: vi.fn(),
    toggleTokenVisibility: vi.fn(),
    toggleTokenHPVisibility: vi.fn(),
    removeToken: vi.fn(),
    removeCondition: vi.fn(),
    _startFacingMode: vi.fn(),
    _clearFacing: vi.fn(),
    setSelectedToken: vi.fn(),
  };
  return mr;
}

beforeEach(() => { document.body.innerHTML = ''; window.ui = {}; });
afterEach(() => { document.body.innerHTML = ''; });

describe('showMapContextMenu', () => {
  it('opens a menu with Add Token + Toggle Fog for GMs and triggers the action on click', () => {
    const mr = makeMr({ isGM: true });
    const menu = showMapContextMenu(mr, 100, 200, 3, 4);
    expect(menu).toBeTruthy();
    expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(5);
    const addBtn = [...menu.querySelectorAll('[role="menuitem"]')]
      .find((el) => el.textContent.includes('Add Token Here'));
    addBtn.click();
    expect(mr.showAddTokenDialog).toHaveBeenCalledWith(3, 4);
    // menu should be closed after click
    expect(document.querySelector('.context-menu')).toBeNull();
  });

  it('does not open for non-GMs', () => {
    const mr = makeMr({ isGM: false });
    const menu = showMapContextMenu(mr, 0, 0, 0, 0);
    expect(menu).toBeNull();
    expect(document.querySelector('.context-menu')).toBeNull();
  });

  it('Reveal Area calls startAreaSelection("reveal")', () => {
    const mr = makeMr({ isGM: true });
    mr.startAreaSelection = vi.fn();
    const menu = showMapContextMenu(mr, 0, 0, 0, 0);
    const reveal = [...menu.querySelectorAll('[role="menuitem"]')]
      .find((el) => el.textContent.includes('Reveal Area'));
    reveal.click();
    expect(mr.startAreaSelection).toHaveBeenCalledWith('reveal');
  });
});

describe('showTokenContextMenu', () => {
  it('shows the slim GM menu and selects the token for the action bar', () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Goblin', type: 'npc', conditions: [] }]]);
    const mr = makeMr({ isGM: true, tokens });
    const menu = showTokenContextMenu(mr, { id: 't1', name: 'Goblin' }, 50, 60);
    expect(menu).toBeTruthy();
    expect(mr.setSelectedToken).toHaveBeenCalledWith('t1');
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);
    expect(labels).toEqual(expect.arrayContaining([
      expect.stringContaining('View Sheet'),
      expect.stringContaining('Remove Token'),
    ]));
    // Damage / heal / conditions moved to the selection bar; the menu
    // stays within working-memory limits (<= 7 items).
    expect(labels.join(' ')).not.toMatch(/Apply Damage|Add Condition/);
    expect(labels.length).toBeLessThanOrEqual(7);
    const removeBtn = menu.querySelector('.context-menu-item--danger');
    expect(removeBtn).toBeTruthy();
    removeBtn.click();
    expect(mr.removeToken).toHaveBeenCalledWith('t1');
  });

  it('non-GM non-owner sees only View Sheet', () => {
    const tokens = new Map([['t1', { id: 't1', name: 'PC', type: 'pc', owner_user_id: '@other:hs' }]]);
    const mr = makeMr({ isGM: false, tokens });
    const menu = showTokenContextMenu(mr, { id: 't1' }, 0, 0);
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('View Sheet');
  });

  it('ArrowDown wraps and Enter activates the focused item', () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Goblin', type: 'npc' }]]);
    const mr = makeMr({ isGM: true, tokens });
    const menu = showTokenContextMenu(mr, { id: 't1' }, 0, 0);
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    items[0].focus();
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    // wrapped to last
    expect(document.activeElement).toBe(items[items.length - 1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // Last item is Remove Token (danger)
    expect(mr.removeToken).toHaveBeenCalledWith('t1');
  });

  it('owner non-GM gets initiative and duplicate but no Remove Token', () => {
    const tokens = new Map([['t1', { id: 't1', name: 'My PC', type: 'pc', owner_user_id: '@me:hs' }]]);
    const mr = makeMr({ isGM: false, tokens });
    const menu = showTokenContextMenu(mr, { id: 't1' }, 0, 0);
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);
    expect(labels).toEqual(expect.arrayContaining([
      expect.stringContaining('Add to Initiative'),
      expect.stringContaining('Duplicate'),
    ]));
    expect(menu.querySelector('.context-menu-item--danger')).toBeNull();
  });

  it('offers Remove from Initiative instead of Add when already in the order', () => {
    const tokens = new Map([['t1', { id: 't1', name: 'Goblin', type: 'npc' }]]);
    const mr = makeMr({ isGM: true, tokens });
    mr.state.initiative = { active: true, order: [{ token_id: 't1' }] };
    const menu = showTokenContextMenu(mr, { id: 't1' }, 0, 0);
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);
    expect(labels.join(' ')).toContain('Remove from Initiative');
    expect(labels.join(' ')).not.toContain('Add to Initiative');
  });
});

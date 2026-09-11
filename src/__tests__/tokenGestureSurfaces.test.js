/**
 * One gesture, one surface. Right-clicking a token used to open its
 * six-item context menu AND select the token, which pops the
 * five-button TokenActionBar: eleven affordances from a single click.
 * Right-click is now the menu alone; left-click selection is the bar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showTokenContextMenu } from '../map/context-menus.js';

function makeMr() {
  const token = { id: 't1', name: 'Goblin', type: 'npc' };
  return /** @type {any} */ ({
    state: {
      tokens: new Map([[token.id, token]]),
      isGM: () => true,
      widgetManager: { userId: '@gm:hs' },
      initiative: { active: false, order: [] },
    },
    setSelectedToken: vi.fn(),
    removeToken: vi.fn(),
    toggleTokenHPVisibility: vi.fn(),
  });
}

describe('token right-click', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('opens the context menu without also selecting the token', () => {
    const mr = makeMr();
    showTokenContextMenu(mr, mr.state.tokens.get('t1'), 10, 10);
    expect(document.querySelector('.context-menu')).not.toBeNull();
    expect(mr.setSelectedToken).not.toHaveBeenCalled();
  });

  it('still offers the menu actions it is the only home for', () => {
    const mr = makeMr();
    showTokenContextMenu(mr, mr.state.tokens.get('t1'), 10, 10);
    const labels = [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);
    expect(labels.some((l) => /initiative/i.test(l))).toBe(true);
    expect(labels.some((l) => /duplicate/i.test(l))).toBe(true);
    expect(labels.some((l) => /remove token/i.test(l))).toBe(true);
  });
});

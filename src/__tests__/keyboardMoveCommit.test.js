/**
 * Enter commits the
 * staged position, Escape rolls back to the cell where M was pressed.
 *
 * Implementation note: the move-mode pipe is collab-safe - each arrow
 * press still publishes through moveTokenBy so other clients see the
 * movement live, but Escape writes the original col/row back as a
 * single state event, restoring the prior position without a local
 * staging buffer that could vanish on tab close.
 */
import { describe, it, expect, vi } from 'vitest';
import { setupKeyboard } from '../map/input/keyboard.js';

function fakeMr({ token = { id: 't1', col: 3, row: 5, name: 'Aria' } } = {}) {
  const updates = [];
  const tokens = new Map([[token.id, { ...token }]]);
  const mr = {
    selectedToken: token.id,
    _moveMode: false,
    state: {
      tokens,
      async updateToken(id, next) {
        const existing = tokens.get(id);
        const merged = { ...existing, ...next };
        tokens.set(id, merged);
        updates.push({ id, col: merged.col, row: merged.row });
      },
    },
    render: vi.fn(),
  };
  return { mr, updates };
}

function press(key, opts = {}) {
  const e = new KeyboardEvent('keydown', { key, ...opts });
  document.dispatchEvent(e);
}

describe('keyboard move mode - Enter/Escape semantics', () => {
  it('Escape after arrow moves restores the original position', async () => {
    const { mr, updates } = fakeMr();
    setupKeyboard(mr);

    press('M');                 // enter move mode
    press('ArrowRight');        // (3,5) → (4,5)
    press('ArrowRight');        // (4,5) → (5,5)
    await Promise.resolve();    // flush microtasks for async updateToken

    press('Escape');            // should rewrite back to (3,5)
    await new Promise((r) => setTimeout(r, 0));

    const last = updates.at(-1);
    expect(last).toMatchObject({ id: 't1', col: 3, row: 5 });
    expect(mr._moveMode).toBe(false);
  });

  it('Enter exits move mode without rewriting the position', async () => {
    const { mr, updates } = fakeMr();
    setupKeyboard(mr);

    press('M');
    press('ArrowDown');         // (3,5) → (3,6)
    await Promise.resolve();
    const beforeEnter = updates.length;

    press('Enter');
    await new Promise((r) => setTimeout(r, 0));

    expect(updates.length).toBe(beforeEnter); // no extra write
    expect(mr._moveMode).toBe(false);
    expect(mr.state.tokens.get('t1')).toMatchObject({ col: 3, row: 6 });
  });
});

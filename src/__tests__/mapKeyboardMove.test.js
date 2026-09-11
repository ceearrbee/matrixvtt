/**
 * Map keyboard move-mode - an arrow key on a selected token arms the
 * mode and moves by one grid cell, Enter commits, Escape rolls back.
 *
 * M is NOT the entry point: the document-level measure-tool binding in
 * useKeyboardShortcuts claims the same letter, so both fired at once.
 * Arming on the arrow key removes the mode instead of rebinding it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupKeyboard } from '../map/input/keyboard.js';

function makeMR(initialToken = { id: 't1', col: 5, row: 5 }) {
  const tokens = new Map();
  tokens.set(initialToken.id, { ...initialToken });
  const mr = {
    selectedToken: initialToken.id,
    state: {
      tokens,
      updateToken: vi.fn(async (id, patch) => {
        const cur = tokens.get(id);
        if (cur) tokens.set(id, { ...cur, ...patch });
      }),
    },
    stage: { container: () => document.body },
    render: vi.fn(),
  };
  return mr;
}

function dispatchKey(key, { code = key, target = document } = {}) {
  const e = new KeyboardEvent('keydown', { key, code, bubbles: true });
  target.dispatchEvent(e);
}

describe('map keyboard move-mode', () => {
  let mr, dispose;

  beforeEach(() => {
    mr = makeMR();
    dispose = setupKeyboard(mr);
  });

  afterEach(() => {
    dispose?.();
  });

  it('M no longer enters move-mode - it belongs to the measure tool', () => {
    dispatchKey('m');
    expect(mr._moveMode).toBeFalsy();
    dispatchKey('M');
    expect(mr._moveMode).toBeFalsy();
  });

  it('an arrow key on a selected token arms move-mode', () => {
    dispatchKey('ArrowRight');
    expect(mr._moveMode).toBe(true);
  });

  it('arrow keys with no selected token do not arm move-mode', async () => {
    mr.selectedToken = null;
    dispatchKey('ArrowRight');
    await Promise.resolve();
    expect(mr._moveMode).toBeFalsy();
    expect(mr.state.updateToken).not.toHaveBeenCalled();
  });

  it('arrow keys move the token by one grid cell', async () => {
    dispatchKey('ArrowRight');
    await Promise.resolve();
    expect(mr.state.updateToken).toHaveBeenCalledWith('t1', expect.objectContaining({ col: 6, row: 5 }));

    dispatchKey('ArrowDown');
    await Promise.resolve();
    expect(mr.state.updateToken).toHaveBeenLastCalledWith('t1', expect.objectContaining({ col: 6, row: 6 }));
  });

  it('Escape exits move-mode', () => {
    dispatchKey('ArrowRight');
    expect(mr._moveMode).toBe(true);
    dispatchKey('Escape');
    expect(mr._moveMode).toBe(false);
  });

  it('arrow keys are ignored when typing into a text input', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    dispatchKey('ArrowRight', { target: input });
    await Promise.resolve();
    expect(mr._moveMode).toBeFalsy();
    expect(mr.state.updateToken).not.toHaveBeenCalled();
    input.remove();
  });
});

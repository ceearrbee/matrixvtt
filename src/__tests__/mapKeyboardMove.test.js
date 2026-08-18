/**
 * Map keyboard move-mode - M to enter, arrow keys to move the selected
 * token by one grid cell, Escape to exit. Implements the
 * movement-mode flow that MapStrip.jsx has been documenting (and
 * keyboard-help.js has been advertising) without an actual handler.
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

  it('pressing M with a selected token enters move-mode', () => {
    dispatchKey('m');
    expect(mr._moveMode).toBe(true);
  });

  it('pressing M with no selected token does not enter move-mode', () => {
    mr.selectedToken = null;
    dispatchKey('m');
    expect(mr._moveMode).toBeFalsy();
  });

  it('arrow keys in move-mode move the token by one grid cell', async () => {
    dispatchKey('m');
    dispatchKey('ArrowRight');
    await Promise.resolve();
    expect(mr.state.updateToken).toHaveBeenCalledWith('t1', expect.objectContaining({ col: 6, row: 5 }));

    dispatchKey('ArrowDown');
    await Promise.resolve();
    expect(mr.state.updateToken).toHaveBeenLastCalledWith('t1', expect.objectContaining({ col: 6, row: 6 }));
  });

  it('arrow keys outside move-mode do not move the token', async () => {
    dispatchKey('ArrowRight');
    await Promise.resolve();
    expect(mr.state.updateToken).not.toHaveBeenCalled();
  });

  it('Escape exits move-mode', () => {
    dispatchKey('m');
    expect(mr._moveMode).toBe(true);
    dispatchKey('Escape');
    expect(mr._moveMode).toBe(false);
  });

  it('M is ignored when typing into a text input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    dispatchKey('m', { target: input });
    expect(mr._moveMode).toBeFalsy();
    input.remove();
  });
});

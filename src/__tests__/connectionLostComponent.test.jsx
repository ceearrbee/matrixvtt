import { describe, it, expect, beforeEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { ConnectionLost } from '../ui/ConnectionLost.jsx';

function setup() {
  const reload = vi.fn();
  /** @type {{ _cb: any } & ((cb: any, ms: any) => number)} */
  const setTimeoutFn = /** @type {any} */ (vi.fn((cb, _ms) => {
    setTimeoutFn._cb = cb;
    return 1;
  }));
  setTimeoutFn._cb = null;
  const clearTimeoutFn = vi.fn();
  /** @type {any} */
  const fakeWin = {
    location: { reload },
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
  };
  const host = document.createElement('div');
  return { fakeWin, host, reload, setTimeoutFn };
}

describe('ConnectionLost component', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('renders the title, body, and Reload-now / Cancel buttons', () => {
    const { fakeWin, host } = setup();
    act(() => render(h(ConnectionLost, { win: fakeWin, errorMessage: 'transport gone' }), host));
    expect(host.textContent).toContain('Connection lost');
    expect(host.textContent).toContain('transport gone');
    expect(host.querySelectorAll('button')).toHaveLength(2);
  });

  it('Reload now button triggers location.reload immediately', () => {
    const { fakeWin, host, reload } = setup();
    act(() => render(h(ConnectionLost, { win: fakeWin }), host));
    const reloadBtn = [...host.querySelectorAll('button')]
      .find((b) => b.textContent === 'Reload now');
    act(() => reloadBtn.click());
    expect(reload).toHaveBeenCalledOnce();
  });

  it('auto-reloads when the countdown hits zero', () => {
    const { fakeWin, host, reload, setTimeoutFn } = setup();
    act(() => render(h(ConnectionLost, { win: fakeWin }), host));

    // 3 → 2 → 1 → 0; the 0 render takes the reload branch.
    for (let i = 0; i < 3; i++) {
      expect(setTimeoutFn._cb, `tick ${i}`).toBeTypeOf('function');
      const tick = setTimeoutFn._cb;
      setTimeoutFn._cb = null;
      act(() => tick());
    }
    expect(reload).toHaveBeenCalledOnce();
  });

  it('Cancel stops the countdown and never reloads', () => {
    const { fakeWin, host, reload, setTimeoutFn } = setup();
    act(() => render(h(ConnectionLost, { win: fakeWin }), host));
    const cancelBtn = [...host.querySelectorAll('button')]
      .find((b) => b.textContent.startsWith('Cancel'));
    act(() => cancelBtn.click());
    // Drain any stale ticks - the cancelled flag short-circuits them.
    if (setTimeoutFn._cb) act(() => setTimeoutFn._cb());
    expect(reload).not.toHaveBeenCalled();
  });

  it('suppresses auto-reload after RELOAD_LIMIT recent reloads', () => {
    sessionStorage.setItem(
      'vtt:connection-lost-reloads',
      JSON.stringify([Date.now() - 1000, Date.now() - 500]),
    );
    const { fakeWin, host, reload } = setup();
    act(() => render(h(ConnectionLost, { win: fakeWin }), host));
    expect(reload).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Couldn’t recover');
  });
});

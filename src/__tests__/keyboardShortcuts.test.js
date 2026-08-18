/**
 * Global keyboard shortcuts are wired by the `useKeyboardShortcuts`
 * Preact hook (mounted from App.jsx). We pin the contract: tool
 * letters route through ui.mapRenderer.setTool when not typing in a
 * form field; Cmd/Ctrl-Z calls undo even while in a form (intentional,
 * so undo works during text editing); GM-only tool keys are gated by
 * ui.state.isGM().
 *
 * Regression: every shortcut must bind exactly once. A previous double-
 * binding (legacy `setupKeyboardShortcuts` + the hook) caused
 * Ctrl+Shift+D to fire twice and toggle the debug bar on-then-off in
 * the same tick.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { useKeyboardShortcuts } from '../ui/useKeyboardShortcuts.js';

// Minimal Preact host that runs the hook with a given `ui` controller.
function HookHost({ ui }) {
  useKeyboardShortcuts(ui);
  return null;
}

function makeUi({ isGM = true } = {}) {
  const undoSpy = vi.fn();
  const redoSpy = vi.fn();
  return {
    mapRenderer: {
      setTool: vi.fn(),
      enablePingMode: vi.fn(),
    },
    state: {
      isGM: () => isGM,
      undoDrawing: undoSpy,
      redoDrawing: redoSpy,
    },
    undoDrawing: () => { if (isGM) return undoSpy(); },
    redoDrawing: () => { if (isGM) return redoSpy(); },
    toggleDebugMode: vi.fn(),
  };
}

function dispatch(opts) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...opts }));
}

let ui;
let unmount;
beforeEach(() => {
  document.body.innerHTML = '';
  ui = makeUi();
  ({ unmount } = render(h(HookHost, { ui })));
});
afterEach(() => { unmount?.(); });

describe('global keyboard shortcuts', () => {
  it('letter v selects the pointer tool', () => {
    dispatch({ key: 'v', code: 'KeyV' });
    expect(ui.mapRenderer.setTool).toHaveBeenCalledWith('pointer');
  });

  it('letter w (wall) is gated by GM role', () => {
    unmount();
    ui = makeUi({ isGM: false });
    ({ unmount } = render(h(HookHost, { ui })));
    dispatch({ key: 'w', code: 'KeyW' });
    expect(ui.mapRenderer.setTool).not.toHaveBeenCalled();
  });

  it('letter t (template) requires GM', () => {
    dispatch({ key: 't', code: 'KeyT' });
    expect(ui.mapRenderer.setTool).toHaveBeenCalledWith('template-circle');
  });

  it('Cmd+Z runs undo even while a text input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    dispatch({ key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(ui.state.undoDrawing).toHaveBeenCalled();
  });

  it('tool letters do NOT fire while a text input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    dispatch({ key: 'v', code: 'KeyV' });
    expect(ui.mapRenderer.setTool).not.toHaveBeenCalled();
  });

  it('unmounting the hook host detaches the listeners', () => {
    unmount();
    dispatch({ key: 'v', code: 'KeyV' });
    expect(ui.mapRenderer.setTool).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+D fires toggleDebugMode exactly once per keypress', () => {
    // A duplicate setupKeyboardShortcuts call double-binds every
    // shortcut, toggling localStorage[vtt:debug] on then off in the
    // same tick so the debug bar looks broken.
    dispatch({ key: 'd', code: 'KeyD', ctrlKey: true, shiftKey: true });
    expect(ui.toggleDebugMode).toHaveBeenCalledTimes(1);
  });
});

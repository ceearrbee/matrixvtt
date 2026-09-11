/**
 * The palette could not be opened in normal use. `Slash` sits inside
 * the typing guard, `_typingInForm()` returns true for a TEXTAREA, and
 * the chat composer is a textarea that holds the shell's resting
 * focus. So the one documented way in was blocked exactly where a user
 * spends their time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import fs from 'node:fs';
import path from 'node:path';
import { useKeyboardShortcuts } from '../ui/useKeyboardShortcuts.js';
import { showCommandPalette } from '../ui/command-palette.js';

vi.mock('../ui/command-palette.js', () => ({ showCommandPalette: vi.fn() }));

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

function HookHost({ ui }) { useKeyboardShortcuts(ui); return null; }

function makeUi() {
  return /** @type {any} */ ({
    mapRenderer: { setTool: vi.fn(), enablePingMode: vi.fn() },
    state: { isGM: () => true, undoDrawing: vi.fn(), redoDrawing: vi.fn() },
    undoDrawing: vi.fn(), redoDrawing: vi.fn(), toggleDebugMode: vi.fn(),
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
  });
}

const dispatch = (opts) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...opts }));

let unmount;
beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(showCommandPalette).mockClear();
  ({ unmount } = render(h(HookHost, { ui: makeUi() })));
});
afterEach(() => { unmount?.(); });

describe('the palette is reachable', () => {
  it('opens with Cmd/Ctrl+K from the chat composer, the shell resting focus', () => {
    const composer = document.createElement('textarea');
    composer.id = 'chat-input';
    document.body.appendChild(composer);
    composer.focus();

    dispatch({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(showCommandPalette).toHaveBeenCalled();
  });

  it('still opens on / outside a text field', () => {
    dispatch({ key: '/', code: 'Slash' });
    expect(showCommandPalette).toHaveBeenCalled();
  });

  it('leaves / alone inside a text field, so it can be typed', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    dispatch({ key: '/', code: 'Slash' });
    expect(showCommandPalette).not.toHaveBeenCalled();
  });

  it('documents both keys, and says the palette runs commands', () => {
    const help = read('src/ui/keyboard-help.js');
    expect(help).toMatch(/Ctrl\+K|Cmd\+K|\$mod\+K/);
    expect(help.toLowerCase()).toMatch(/command/);
  });

  it('has a visible affordance, not only a key nobody was told about', () => {
    expect(read('src/ui/global-menu-items.js')).toMatch(/showCommandPalette/);
  });
});

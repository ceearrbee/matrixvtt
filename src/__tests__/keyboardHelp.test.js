/**
 * Keyboard shortcut help panel - showKeyboardHelp
 *
 * Pressing ? (when not in an input) should show a modal listing all
 * keyboard shortcuts. The modal content must cover the known drawing-tool
 * keys (v/p/l/r/c/k/m/e/g) and the undo/redo shortcuts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showKeyboardHelp } from '../ui/keyboard-help.js';

function makeUi() {
  return { _toast: vi.fn() };
}

describe('showKeyboardHelp', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('appends a modal dialog to the document body', () => {
    showKeyboardHelp();
    const modal = document.querySelector('[role="dialog"]');
    expect(modal).not.toBeNull();
  });

  it('modal lists the pointer tool shortcut', () => {
    showKeyboardHelp();
    expect(document.body.innerHTML).toMatch(/\bV\b/);
    expect(document.body.innerHTML.toLowerCase()).toMatch(/select/);
  });

  it('modal lists the pencil/draw tool shortcut', () => {
    showKeyboardHelp();
    expect(document.body.innerHTML).toMatch(/\bP\b/);
    expect(document.body.innerHTML.toLowerCase()).toMatch(/pencil|draw/);
  });

  it('modal lists undo shortcut', () => {
    showKeyboardHelp();
    expect(document.body.innerHTML.toLowerCase()).toMatch(/undo/);
  });

  it('modal includes a close button', () => {
    showKeyboardHelp();
    const close = document.querySelector('[data-modal-close], button[aria-label*="lose"]');
    expect(close).not.toBeNull();
  });
});

describe('chat command reference', () => {
  it('lists the slash commands a dismissed tour would otherwise hide forever', () => {
    showKeyboardHelp(/** @type {any} */ ({}));
    try {
      const text = document.body.textContent;
      for (const cmd of ['/roll', '/w', '/as', '/asd']) {
        expect(text, `missing ${cmd}`).toContain(cmd);
      }
      expect(text).toMatch(/chat commands/i);
    } finally {
      document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
    }
  });
});

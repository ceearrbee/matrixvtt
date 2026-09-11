/**
 * `canEditPage` returns true for a page you authored, unconditionally,
 * so a player has always been allowed to write one. There was no path:
 * the only creation entry was the header's Create menu, behind
 * `isGM && prepActive`, and the Journal drawer's empty state offered
 * only "Add a handout", which is a GM surface.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { JournalDrawer } from '../ui/index-sections.js';
import { handoutsSignal, pagesSignal } from '../state/signals.js';

function makeUi({ isGM = false } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      handouts: new Map(), pages: new Map(),
      widgetManager: { userId: '@bo:hs' },
      settings: { systemConfig: {} },
      powerLevels: null,
    },
    widgetManager: { userId: '@bo:hs' },
    showPageForm: vi.fn(),
    showHandoutForm: vi.fn(),
  });
}

describe('the Journal drawer offers a player a way in', () => {
  afterEach(() => {
    cleanup();
    handoutsSignal.value = new Map();
    pagesSignal.value = new Map();
  });

  it('offers a page to a player, who may author one', () => {
    const ui = makeUi({ isGM: false });
    const { container } = render(h(JournalDrawer, { ui }));
    const cta = [...container.querySelectorAll('button')].find((b) => /page/i.test(b.textContent));
    expect(cta, 'no way for a player to write a page').toBeTruthy();
    fireEvent.click(cta);
    expect(ui.showPageForm).toHaveBeenCalled();
  });

  it('still offers a GM the handout, which is a GM surface', () => {
    const ui = makeUi({ isGM: true });
    const { container } = render(h(JournalDrawer, { ui }));
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels.some((l) => /handout/i.test(l))).toBe(true);
  });
});

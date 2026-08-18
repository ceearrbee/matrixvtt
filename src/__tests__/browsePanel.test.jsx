/**
 * BrowsePanel - rpglog-style log-browse hub.
 *
 * First cut surfaces two sub-tabs that are pure read-only projections
 * over `ui.activityLog`:
 *   - Find   - substring search across entry text
 *   - Rolls  - dice entries only (icon === '🎲')
 *
 * The remaining rpglog tabs (TOC, Pins, Mentions, NPCs, Filter) need
 * existing engine surfaces they don't yet have analogues for; they
 * land in later passes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { BrowsePanel } from '../ui/BrowsePanel.jsx';
import { logVersionSignal } from '../state/ui-signals.js';

function makeUi(activityLog = []) {
  return /** @type {any} */ ({ activityLog });
}

const SAMPLE = [
  { icon: '💬', text: 'Aria: hello there', msgtype: 'm.text' },
  { icon: '🎲', text: 'Bart rolled 17 (1d20+2)', msgtype: undefined },
  { icon: '📢', text: '((OOC)) brb', msgtype: 'm.notice' },
  { icon: '🎲', text: 'Aria rolled 3 (1d20)', msgtype: undefined },
  { icon: '⚔️', text: 'combat started', msgtype: undefined },
];

beforeEach(() => { logVersionSignal.value = 0; });
afterEach(cleanup);

describe('BrowsePanel - scaffold', () => {
  it('renders Find and Rolls sub-tabs', () => {
    const { container } = render(h(BrowsePanel, { ui: makeUi() }));
    expect(container.querySelector('[data-browse-tab="find"]')).not.toBeNull();
    expect(container.querySelector('[data-browse-tab="rolls"]')).not.toBeNull();
  });

  it('Find is the default tab', () => {
    const { container } = render(h(BrowsePanel, { ui: makeUi() }));
    expect(container.querySelector('[data-browse-tab="find"]').getAttribute('aria-selected'))
      .toBe('true');
    expect(container.querySelector('[data-browse-panel="find"]')).not.toBeNull();
    expect(container.querySelector('[data-browse-panel="rolls"]')).toBeNull();
  });

  it('clicking a tab switches the panel', () => {
    const { container } = render(h(BrowsePanel, { ui: makeUi() }));
    fireEvent.click(container.querySelector('[data-browse-tab="rolls"]'));
    expect(container.querySelector('[data-browse-panel="rolls"]')).not.toBeNull();
    expect(container.querySelector('[data-browse-panel="find"]')).toBeNull();
  });
});

describe('BrowsePanel - Find', () => {
  it('renders a search input', () => {
    const { container } = render(h(BrowsePanel, { ui: makeUi(SAMPLE) }));
    expect(container.querySelector('[data-browse-find-input]')).not.toBeNull();
  });

  it('hides results before any query is entered', () => {
    const { container } = render(h(BrowsePanel, { ui: makeUi(SAMPLE) }));
    expect(container.querySelectorAll('[data-browse-result]').length).toBe(0);
  });

  it('filters activityLog by case-insensitive substring on the entry text', () => {
    const { container } = render(h(BrowsePanel, { ui: makeUi(SAMPLE) }));
    const input = container.querySelector('[data-browse-find-input]');
    input.value = 'aria';
    fireEvent.input(input, { target: input });
    const items = container.querySelectorAll('[data-browse-result]');
    expect(items.length).toBe(2);
    expect(container.textContent).toContain('Aria: hello');
    expect(container.textContent).toContain('Aria rolled');
  });

  it('shows an empty-state hint when the query matches nothing', () => {
    const { container } = render(h(BrowsePanel, { ui: makeUi(SAMPLE) }));
    const input = container.querySelector('[data-browse-find-input]');
    input.value = 'zzz';
    fireEvent.input(input, { target: input });
    expect(container.querySelector('[data-browse-empty]')).not.toBeNull();
  });
});

describe('BrowsePanel - Rolls', () => {
  it('lists only dice entries (icon === 🎲)', () => {
    const { container } = render(h(BrowsePanel, { ui: makeUi(SAMPLE) }));
    fireEvent.click(container.querySelector('[data-browse-tab="rolls"]'));
    const items = container.querySelectorAll('[data-browse-result]');
    expect(items.length).toBe(2);
    expect(container.textContent).toContain('Bart rolled 17');
    expect(container.textContent).toContain('Aria rolled 3');
    expect(container.textContent).not.toContain('hello there');
    expect(container.textContent).not.toContain('combat started');
  });

  it('shows an empty-state hint when no rolls have been made', () => {
    const { container } = render(h(BrowsePanel, {
      ui: makeUi([{ icon: '💬', text: 'just chat' }]),
    }));
    fireEvent.click(container.querySelector('[data-browse-tab="rolls"]'));
    expect(container.querySelector('[data-browse-empty]')).not.toBeNull();
  });
});

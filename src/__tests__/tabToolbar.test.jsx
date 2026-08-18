/**
 * TabToolbar + SrdButton - the one shared tab header title/action row
 * and gated "add from SRD compendium" button for Items, Spells, and
 * the entity list.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';

const { mockAvailable, mockOpen } = vi.hoisted(() => ({
  mockAvailable: vi.fn(),
  mockOpen: vi.fn(),
}));
vi.mock('../ui/compendium/open-browser.js', () => ({
  compendiumAvailable: mockAvailable,
  openCompendiumBrowser: mockOpen,
}));

import { TabToolbar, SrdButton } from '../ui/TabToolbar.jsx';

afterEach(() => { cleanup(); mockAvailable.mockReset(); mockOpen.mockReset(); });

describe('TabToolbar', () => {
  it('renders the title and action children in a .tab-toolbar', () => {
    const { container } = render(
      h(TabToolbar, { title: 'Spellbook' }, h('button', { type: 'button' }, '+ Add'))
    );
    const bar = container.querySelector('.tab-toolbar');
    expect(bar).not.toBeNull();
    expect(bar.querySelector('.tab-toolbar__title').textContent).toBe('Spellbook');
    expect(bar.querySelector('button').textContent).toBe('+ Add');
  });

  it('applies a modifier class instead of inline layout styles', () => {
    const { container } = render(h(TabToolbar, { title: 'All items', modifier: 'cluster' }, null));
    expect(container.querySelector('.tab-toolbar--cluster')).not.toBeNull();
  });
});

describe('SrdButton', () => {
  const ui = {};

  it('renders nothing when the compendium is unavailable', () => {
    mockAvailable.mockReturnValue(false);
    const { container } = render(h(SrdButton, { ui, kind: 'item' }));
    expect(container.querySelector('[data-compendium-open]')).toBeNull();
  });

  it('opens the compendium browser for its kind when available', () => {
    mockAvailable.mockReturnValue(true);
    const { container } = render(h(SrdButton, { ui, kind: 'spell' }));
    const btn = container.querySelector('[data-compendium-open="spell"]');
    expect(btn).not.toBeNull();
    fireEvent.click(btn);
    expect(mockOpen).toHaveBeenCalledWith(ui, 'spell');
  });

  it('accepts a custom label', () => {
    mockAvailable.mockReturnValue(true);
    const { container } = render(h(SrdButton, { ui, kind: 'monster', label: '📖 Add from SRD' }));
    expect(container.querySelector('[data-compendium-open="monster"]').textContent).toBe('📖 Add from SRD');
  });

  it('condenses to an icon under the icon layout mode, keeping the accessible name', async () => {
    mockAvailable.mockReturnValue(true);
    const { layoutModeSignal } = await import('../state/ui-signals.js');
    const { LAYOUT_MODES } = await import('../utils/constants.js');
    layoutModeSignal.value = LAYOUT_MODES.ICON;
    const { container } = render(h(SrdButton, { ui, kind: 'item', label: '📖 SRD' }));
    const btn = container.querySelector('[data-compendium-open="item"]');
    expect(btn.textContent).toBe('📖');
    expect(btn.getAttribute('aria-label')).toMatch(/items/i);
    layoutModeSignal.value = LAYOUT_MODES.TEXT;
  });
});

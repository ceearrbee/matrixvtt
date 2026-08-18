/**
 * GlobalMenu - renders the buildGlobalMenuItems rows as a button list.
 * Hosted as the `globalMenu` popup (desktop) and inside the IconRail
 * menu drawer (mobile).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { GlobalMenu } from '../ui/GlobalMenu.jsx';

beforeEach(() => { vi.restoreAllMocks(); });

function makeUi() {
  return {
    openSettings: vi.fn(), toggleTheme: vi.fn(), openMapsPanel: vi.fn(),
    state: { isGM: () => true }, widgetManager: { canLeave: false },
  };
}

describe('GlobalMenu', () => {
  it('renders a button per item', () => {
    const { container } = render(h(GlobalMenu, { ui: makeUi(), onSelect: () => {} }));
    expect(container.querySelector('[data-menu-item="settings"]')).not.toBeNull();
    expect(container.querySelector('[data-menu-item="maps"]')).not.toBeNull();
  });

  it('clicking an item runs its action and calls onSelect', () => {
    const ui = makeUi();
    const onSelect = vi.fn();
    render(h(GlobalMenu, { ui, onSelect }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(ui.openSettings).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('hides Maps for a non-GM', () => {
    const ui = makeUi();
    ui.state.isGM = () => false;
    const { container } = render(h(GlobalMenu, { ui, onSelect: () => {} }));
    expect(container.querySelector('[data-menu-item="maps"]')).toBeNull();
  });
});

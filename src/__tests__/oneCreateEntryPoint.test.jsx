/**
 * Three ways to create something: the header's + New menu, the GM
 * panel's Add tab with its own three buttons, and per-tab "+ Add X".
 * The GM Add panel now defers to the one menu instead of declaring a
 * narrower copy of it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { AddEntitiesPanel } from '../ui/gm/panels/AddEntitiesPanel.jsx';
import { openNewMenu } from '../ui/NewEntityMenu.jsx';

vi.mock('../ui/NewEntityMenu.jsx', () => ({ openNewMenu: vi.fn() }));

const ui = /** @type {any} */ ({ showTokenForm: vi.fn(), showEntityForm: vi.fn(), showItemForm: vi.fn() });

describe('GM Add panel', () => {
  afterEach(cleanup);

  it('offers one entry, not three narrower copies', () => {
    const { container } = render(h(AddEntitiesPanel, { ui }));
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('opens the shared create menu', () => {
    const { container } = render(h(AddEntitiesPanel, { ui }));
    fireEvent.click(container.querySelector('button'));
    expect(openNewMenu).toHaveBeenCalledWith(ui);
    expect(ui.showTokenForm).not.toHaveBeenCalled();
  });
});

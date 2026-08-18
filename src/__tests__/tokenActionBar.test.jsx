/**
 * Contextual token action bar (tldraw pattern): selecting a token
 * surfaces its 3-5 most common actions next to the map instead of
 * burying them mid-way down a 15-item context menu.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { fireEvent } from '@testing-library/preact';
import { buildTokenBarActions } from '../ui/token-bar-actions.js';
import { TokenActionBar } from '../ui/TokenActionBar.jsx';
import { selectedTokenSignal } from '../state/ui-signals.js';
import { tokensSignal } from '../state/signals.js';

const TOKEN = { id: 't1', name: 'Goblin', type: 'npc', owner_user_id: null, visible: true };

describe('buildTokenBarActions', () => {
  it('gives the GM sheet, damage, heal, condition, and hide', () => {
    const ids = buildTokenBarActions({ isGM: true, isOwner: false, token: TOKEN }).map((a) => a.id);
    expect(ids).toEqual(['sheet', 'damage', 'heal', 'condition', 'hide']);
  });

  it('gives an owner sheet, damage, and heal', () => {
    const ids = buildTokenBarActions({ isGM: false, isOwner: true, token: TOKEN }).map((a) => a.id);
    expect(ids).toEqual(['sheet', 'damage', 'heal']);
  });

  it('gives everyone else only the sheet', () => {
    const ids = buildTokenBarActions({ isGM: false, isOwner: false, token: TOKEN }).map((a) => a.id);
    expect(ids).toEqual(['sheet']);
  });

  it('labels the hide action by current visibility', () => {
    const shown = buildTokenBarActions({ isGM: true, isOwner: false, token: TOKEN });
    expect(shown.find((a) => a.id === 'hide').label).toBe('Hide');
    const hidden = buildTokenBarActions({ isGM: true, isOwner: false, token: { ...TOKEN, visible: false } });
    expect(hidden.find((a) => a.id === 'hide').label).toBe('Show');
  });
});

describe('TokenActionBar', () => {
  let host;
  function makeUi({ isGM = true } = {}) {
    return /** @type {any} */ ({
      state: { isGM: () => isGM, tokens: tokensSignal.value },
      widgetManager: { userId: '@me:m' },
      mapRenderer: {
        showDamageDialog: vi.fn(),
        showConditionDialog: vi.fn(),
        toggleTokenVisibility: vi.fn(),
      },
    });
  }
  beforeEach(() => {
    tokensSignal.value = new Map([[TOKEN.id, TOKEN]]);
    selectedTokenSignal.value = null;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    selectedTokenSignal.value = null;
    tokensSignal.value = new Map();
  });

  it('renders nothing without a selection', () => {
    render(h(TokenActionBar, { ui: makeUi() }), host);
    expect(host.querySelector('.token-action-bar')).toBeNull();
  });

  it('shows the selected token name and actions, wired to the renderer', () => {
    selectedTokenSignal.value = TOKEN.id;
    const ui = makeUi();
    render(h(TokenActionBar, { ui }), host);
    const bar = host.querySelector('.token-action-bar');
    expect(bar).not.toBeNull();
    expect(bar.textContent).toContain('Goblin');
    fireEvent.click(bar.querySelector('[data-bar-action="damage"]'));
    expect(ui.mapRenderer.showDamageDialog).toHaveBeenCalledWith(TOKEN.id, 'damage');
    fireEvent.click(bar.querySelector('[data-bar-action="condition"]'));
    expect(ui.mapRenderer.showConditionDialog).toHaveBeenCalledWith(TOKEN.id);
  });

  it('clears when the selection clears', () => {
    selectedTokenSignal.value = TOKEN.id;
    render(h(TokenActionBar, { ui: makeUi() }), host);
    expect(host.querySelector('.token-action-bar')).not.toBeNull();
    selectedTokenSignal.value = null;
    return Promise.resolve().then(() => {
      expect(host.querySelector('.token-action-bar')).toBeNull();
    });
  });
});

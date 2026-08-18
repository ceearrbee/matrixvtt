/**
 * GMTab - sidebar tab that hosts GM tools via sub-navigation.
 * Defaults to the Tables sub-panel; sub-nav buttons swap the rendered panel.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { tablesSignal } from '../state/signals.js';
import { GMTab } from '../ui/GMTab.jsx';

function makeUi() {
  return {
    state: {
      isGM: () => true,
      tables: new Map(),
      settings: { environment: {} },
      damageLog: [],
    },
    showTokenForm: vi.fn(),
    showItemForm: vi.fn(),
    showEntityForm: vi.fn(),
    showTableForm: vi.fn(),
    rollTable: vi.fn(),
    deleteTable: vi.fn(),
    rollInitiative: vi.fn(),
    prevTurn: vi.fn(),
    nextTurn: vi.fn(),
    endCombat: vi.fn(),
    exportState: vi.fn(),
    exportCharactersMarkdown: vi.fn(),
    exportNPCsMarkdown: vi.fn(),
    showImportMarkdownDialog: vi.fn(),
  };
}

describe('<GMTab>', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
    tablesSignal.value = new Map();
  });

  it('renders sub-nav buttons for each section', () => {
    render(h(GMTab, { ui: makeUi() }), host);
    const navText = host.querySelector('[data-gm-subnav]')?.textContent || '';
    expect(navText).toMatch(/tables/i);
    expect(navText).toMatch(/combat/i);
    expect(navText).toMatch(/fog/i);
    expect(navText).toMatch(/environment/i);
    expect(navText).toMatch(/templates/i);
    expect(navText).toMatch(/import/i);
    expect(navText).toMatch(/damage/i);
  });

  it('defaults to the Tables sub-panel', () => {
    render(h(GMTab, { ui: makeUi() }), host);
    expect(host.querySelector('.gm-panel--tables')).toBeTruthy();
    expect(host.querySelector('.gm-panel--combat')).toBeNull();
  });

  it('switching sub-nav swaps the rendered panel', async () => {
    render(h(GMTab, { ui: makeUi() }), host);
    const combatBtn = host.querySelector('[data-gm-subnav-id="combat"]');
    combatBtn?.click();
    await new Promise(r => setTimeout(r, 0));
    expect(host.querySelector('.gm-panel--combat')).toBeTruthy();
    expect(host.querySelector('.gm-panel--tables')).toBeNull();
  });

  it('renders nothing for non-GM users', () => {
    const ui = makeUi();
    ui.state.isGM = () => false;
    render(h(GMTab, { ui }), host);
    expect(host.querySelector('[data-gm-subnav]')).toBeNull();
  });
});

/**
 * Initiative rows default to a
 * collapsed (name + init + HP) form for non-current non-expanded rows.
 * A chevron button toggles the expanded form. Active rows ignore the
 * collapse (they always show the full body). Clicking the row body
 * still triggers the preview (not the expand).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';

// dnd-kit ships as React and trips happy-dom under Preact - mock per
// the existing initiativeHPButtons.test.js pattern.
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());
  return {
    ...actual,
    DndContext: (props) => h('div', null, props.children),
    useSensor: vi.fn(), useSensors: vi.fn(() => []),
    PointerSensor: {}, KeyboardSensor: {},
  };
});
vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());
  return {
    ...actual,
    useSortable: vi.fn(() => ({
      attributes: {}, listeners: {}, setNodeRef: vi.fn(),
      transform: null, transition: undefined, isDragging: false,
    })),
    SortableContext: (props) => h('div', null, props.children),
  };
});

import { InitiativeEntry } from '../ui/InitiativeEntry.jsx';

const PASS_HP = (e) => Math.round(((e.hp_current ?? 0) / Math.max(1, e.hp_max ?? 1)) * 100);

let host;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { render(null, host); host.remove(); });

function makeUi() {
  return {
    state: {
      tokens: new Map([['t1', { id: 't1', name: 'Kael', ac: 16, color: '#fff' }]]),
      characters: new Map(),
      npcs: new Map(),
      initiative: { order: [{ token_id: 't1' }], active: true, round: 1, current_index: 99 },
      isGM: () => true,
      isTokenVisibleToPlayer: () => true,
      settings: { systemConfig: {} },
      widgetManager: { userId: '@gm:s' },
    },
    previewToken: vi.fn(),
    _selectTokenAndSwitchTab: vi.fn(),
    _isMyCombatTurn: () => false,
  };
}

function renderEntry({ ui, entry, current_index, isExpanded, onExpand }) {
  render(
    h(InitiativeEntry, {
      ui,
      entry,
      index: 0,
      current_index,
      isGM: true,
      myTurn: false,
      actionEconomy: [],
      getHPPercentage: PASS_HP,
      isExpanded,
      onExpand,
    }),
    host,
  );
}

const KAEL = {
  token_id: 't1', name: 'Kael', initiative: 12,
  hp_current: 22, hp_max: 35,
};

describe('InitiativeEntry collapse/expand (Phase 2)', () => {
  it('non-current row defaults to compact: no AC, no HP-adjust', () => {
    renderEntry({ ui: makeUi(), entry: KAEL, current_index: 99, isExpanded: false, onExpand: () => {} });
    expect(host.querySelector('.ie__ac')).toBeNull();
    expect(host.querySelector('.ie__hp-adjust')).toBeNull();
  });

  it('expanded row reveals AC + HP-adjust controls', () => {
    renderEntry({ ui: makeUi(), entry: KAEL, current_index: 99, isExpanded: true, onExpand: () => {} });
    expect(host.querySelector('.ie__ac')?.textContent).toMatch(/AC 16/);
    expect(host.querySelector('.ie__hp-adjust')).not.toBeNull();
  });

  it('active (current) row always shows the full body even when collapsed', () => {
    renderEntry({ ui: makeUi(), entry: KAEL, current_index: 0, isExpanded: false, onExpand: () => {} });
    expect(host.querySelector('.ie__ac')?.textContent).toMatch(/AC 16/);
  });

  it('chevron click calls onExpand with the token id', () => {
    const onExpand = vi.fn();
    renderEntry({ ui: makeUi(), entry: KAEL, current_index: 99, isExpanded: false, onExpand });
    host.querySelector('.ie__expand-toggle').click();
    expect(onExpand).toHaveBeenCalledWith('t1');
  });

  it('chevron shows ▾ when collapsed and ▴ when expanded', () => {
    const ui = makeUi();
    renderEntry({ ui, entry: KAEL, current_index: 99, isExpanded: false, onExpand: () => {} });
    expect(host.querySelector('.ie__expand-toggle').textContent).toBe('▾');
    renderEntry({ ui, entry: KAEL, current_index: 99, isExpanded: true, onExpand: () => {} });
    expect(host.querySelector('.ie__expand-toggle').textContent).toBe('▴');
  });

  it('active row hides the chevron (no per-row expansion possible)', () => {
    renderEntry({ ui: makeUi(), entry: KAEL, current_index: 0, isExpanded: false, onExpand: () => {} });
    expect(host.querySelector('.ie__expand-toggle')).toBeNull();
  });

  it('clicking the row body (not the chevron) triggers preview, not expand', () => {
    const ui = makeUi();
    const onExpand = vi.fn();
    renderEntry({ ui, entry: KAEL, current_index: 99, isExpanded: false, onExpand });
    host.querySelector('.ie__name').click();
    expect(ui.previewToken).toHaveBeenCalledWith('t1');
    expect(onExpand).not.toHaveBeenCalled();
  });
});

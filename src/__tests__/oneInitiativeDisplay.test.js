/**
 * Two turn-order displays were mounted by phase from App: the full
 * InitiativeBar and the slim CombatInitiativeStrip. One component, one
 * mount, a compact variant for Combat - the same shape the left rail
 * uses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import fs from 'node:fs';
import path from 'node:path';
import { render, cleanup } from '@testing-library/preact';

vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...(await importOriginal()),
  DndContext: (props) => h('div', null, props.children),
  useSensor: vi.fn(), useSensors: vi.fn(() => []),
  PointerSensor: {}, KeyboardSensor: {},
}));
vi.mock('@dnd-kit/sortable', async (importOriginal) => ({
  ...(await importOriginal()),
  useSortable: vi.fn(() => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(),
    transform: null, transition: undefined, isDragging: false,
  })),
  SortableContext: (props) => h('div', null, props.children),
}));

const { InitiativeBar } = await import('../ui/InitiativeBar.jsx');
const { initiativeSignal, tokensSignal } = await import('../state/signals.js');

const order = [{ token_id: 't1', name: 'Aria', initiative: 18, hp_current: 9, hp_max: 12 }];

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      initiative: { active: true, round: 1, current_index: 0, order },
      tokens: new Map([['t1', { id: 't1', name: 'Aria', color: '#888' }]]),
      settings: { systemConfig: {} },
      fog: { mode: null, revealed: [] },
      isTokenVisibleToPlayer: () => true,
    },
    widgetManager: { userId: '@me:m' },
    _isMyCombatTurn: () => false,
  });
}

describe('one initiative display', () => {
  beforeEach(() => {
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order };
    tokensSignal.value = new Map([['t1', { id: 't1', name: 'Aria', color: '#888' }]]);
  });
  afterEach(cleanup);

  it('App mounts the tracker once, with a compact flag', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/ui/App.jsx'), 'utf8');
    expect(src.match(/h\(InitiativeBar/g)).toHaveLength(1);
    expect(src).not.toMatch(/from '\.\/CombatInitiativeStrip\.jsx'/);
    expect(src).toMatch(/compact:/);
  });

  it('renders the full tracker panel by default', () => {
    const { container } = render(h(InitiativeBar, { ui: makeUi() }));
    expect(container.querySelector('.initiative-panel')).not.toBeNull();
    expect(container.querySelector('.combat-init-strip')).toBeNull();
  });

  it('renders the slim strip when compact', () => {
    const { container } = render(h(InitiativeBar, { ui: makeUi(), compact: true }));
    expect(container.querySelector('.combat-init-strip')).not.toBeNull();
    expect(container.querySelector('.initiative-panel')).toBeNull();
  });

  it('names the same combatant either way', () => {
    const full = render(h(InitiativeBar, { ui: makeUi() }));
    expect(full.container.textContent).toContain('Aria');
    cleanup();
    const slim = render(h(InitiativeBar, { ui: makeUi(), compact: true }));
    expect(slim.container.textContent).toContain('Aria');
  });
});

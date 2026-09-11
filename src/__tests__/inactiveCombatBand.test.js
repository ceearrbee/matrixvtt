/**
 * With no combat running, the initiative tracker was a full-width
 * titled band overlaying the top of the map to announce that nothing
 * was happening - about 90px of map spent on "No combat in progress".
 * Resting state is one button; the band is for when there is an order
 * to show.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
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

const IDLE = { active: false, round: 0, current_index: 0, order: [] };

function makeUi({ isGM = true, initiative = IDLE } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      initiative,
      tokens: new Map(),
      settings: { systemConfig: {} },
      fog: { mode: null, revealed: [] },
      isTokenVisibleToPlayer: () => true,
    },
    widgetManager: { userId: '@me:m' },
    _isMyCombatTurn: () => false,
    rollInitiative: vi.fn(),
  });
}

describe('initiative tracker at rest', () => {
  beforeEach(() => {
    initiativeSignal.value = IDLE;
    tokensSignal.value = new Map();
  });
  afterEach(cleanup);

  it('is a single start button, not a titled band', () => {
    const { container } = render(h(InitiativeBar, { ui: makeUi() }));
    const idle = container.querySelector('.initiative-idle');
    expect(idle).not.toBeNull();
    expect(container.querySelector('.initiative-panel')).toBeNull();
    expect(idle.querySelectorAll('button')).toHaveLength(1);
  });

  it('says nothing about there being no combat', () => {
    const { container } = render(h(InitiativeBar, { ui: makeUi() }));
    expect(container.textContent).not.toMatch(/no combat in progress/i);
  });

  it('still starts combat', () => {
    const ui = makeUi();
    const { container } = render(h(InitiativeBar, { ui }));
    container.querySelector('.initiative-idle button').click();
    expect(ui.rollInitiative).toHaveBeenCalled();
  });

  it('shows a player nothing at all until there is an order', () => {
    const { container } = render(h(InitiativeBar, { ui: makeUi({ isGM: false }) }));
    expect(container.querySelector('.initiative-idle')).toBeNull();
    expect(container.querySelector('.initiative-panel')).toBeNull();
  });

  it('returns to the full tracker once combat is running', () => {
    const order = [{ token_id: 't1', name: 'Aria', initiative: 18 }];
    const active = { active: true, round: 1, current_index: 0, order };
    initiativeSignal.value = active;
    const { container } = render(h(InitiativeBar, { ui: makeUi({ initiative: active }) }));
    expect(container.querySelector('.initiative-panel')).not.toBeNull();
    expect(container.querySelector('.initiative-idle')).toBeNull();
  });
});

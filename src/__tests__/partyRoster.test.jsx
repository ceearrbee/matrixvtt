/**
 * PartyRoster - the "who's at my table" view.
 *
 * Shows every PC (the party) plus the NPCs the current user CONTROLS
 * (summons / familiars / henchmen a GM assigned to them) under a
 * "Companions" section. The GM's monster roster is NOT dumped here -
 * that lives in the NPCs tab. Each card: avatar + name + subtitle + HP
 * bar + AC/Speed/Init + condition icons; click selects + switches tab.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { PartyRoster } from '../ui/PartyRoster.jsx';
import {
  charactersSignal, npcsSignal, tokensSignal, settingsSignal,
} from '../state/signals.js';

const ME = '@me:fake';

function mkUi(overrides = {}) {
  const npcOverrides = overrides.npc || {};
  delete overrides.npc;
  return /** @type {any} */ ({
    widgetManager: { userId: ME },
    state: {
      characters: new Map([
        ['chr-aria', {
          id: 'chr-aria', name: 'Aria Blackwood',
          race: 'Halfling', class_name: 'Rogue', level: 5,
          hp_current: 28, hp_max: 40, ac: 15, speed: 30,
        }],
      ]),
      npcs: new Map([
        ['npc-orc', {
          id: 'npc-orc', name: 'Orc War Boss', cr: 2,
          hp_current: 45, hp_max: 60, ac: 14,
          ...npcOverrides,
        }],
      ]),
      tokens: new Map([
        ['tok-aria', {
          id: 'tok-aria', sheet_id: 'chr-aria',
          color: '#185FA5', conditions: ['poisoned'],
        }],
      ]),
      settings: { systemConfig: {} },
    },
    selectCharacterById: vi.fn(),
    selectNPCById: vi.fn(),
    switchTab: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  charactersSignal.value = new Map();
  npcsSignal.value = new Map();
  tokensSignal.value = new Map();
  settingsSignal.value = { systemConfig: {} };
});
afterEach(() => { cleanup(); });

describe('PartyRoster', () => {
  it('renders PC cards and excludes NPCs nobody controls (the GM monster roster)', () => {
    const { container } = render(h(PartyRoster, { ui: mkUi() }));
    const cards = container.querySelectorAll('.party-roster__card');
    expect(cards.length).toBe(1);
    expect(container.textContent).toContain('Aria Blackwood');
    expect(container.textContent).not.toContain('Orc War Boss');
  });

  it('shows an NPC the current user controls under Companions', () => {
    const { container } = render(h(PartyRoster, { ui: mkUi({ npc: { controlled_by: ME } }) }));
    const cards = container.querySelectorAll('.party-roster__card');
    expect(cards.length).toBe(2);
    expect(container.textContent).toContain('Orc War Boss');
    expect(container.textContent).toContain('CR 2');
  });

  it('excludes NPCs controlled by a different user', () => {
    const { container } = render(h(PartyRoster, { ui: mkUi({ npc: { controlled_by: '@someone-else:fake' } }) }));
    expect(container.querySelectorAll('.party-roster__card').length).toBe(1);
    expect(container.textContent).not.toContain('Orc War Boss');
  });

  it('shows HP bar + numeric fraction', () => {
    const { container } = render(h(PartyRoster, { ui: mkUi() }));
    expect(container.querySelector('.party-roster__hpbar')).not.toBeNull();
    expect(container.textContent).toContain('28 / 40');
  });

  it('clicking a PC card selects the character and switches to Sheet tab', () => {
    const ui = mkUi();
    const { container } = render(h(PartyRoster, { ui }));
    fireEvent.click(container.querySelectorAll('.party-roster__card')[0]);
    expect(ui.selectCharacterById).toHaveBeenCalledWith('chr-aria');
    expect(ui.switchTab).toHaveBeenCalledWith('sheet');
  });

  it('clicking a controlled companion selects the NPC and switches to NPC tab', () => {
    const ui = mkUi({ npc: { controlled_by: ME } });
    const { container } = render(h(PartyRoster, { ui }));
    fireEvent.click(container.querySelectorAll('.party-roster__card')[1]);
    expect(ui.selectNPCById).toHaveBeenCalledWith('npc-orc');
    expect(ui.switchTab).toHaveBeenCalledWith('npc');
  });

  it('renders an EmptyState when there are no PCs and no controlled companions', () => {
    const ui = mkUi();
    ui.state.characters = new Map();
    ui.state.npcs = new Map();
    const { container } = render(h(PartyRoster, { ui }));
    expect(container.querySelector('.party-roster__card')).toBeNull();
    expect(container.textContent).toContain('No characters yet');
  });
});

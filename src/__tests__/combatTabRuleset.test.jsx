/**
 * The combat tab follows the active ruleset. Slot-paired systems
 * (Risus) surface the combatant's named pools as rollable actions
 * because the cliché IS the combat action; an empty
 * ruleset.action_economy hides the d20 Action/Bonus/Reaction pips;
 * and the current-combatant card shows HP only when the entry has it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { CombatTab } from '../ui/CombatTab.jsx';
import { initiativeSignal, tokensSignal } from '../state/signals.js';
import risus from '../content/rulesets/risus.json';
import dnd5e from '../content/rulesets/dnd5e.json';

function makeUi(systemConfig, { character, token, entry } = /** @type {any} */ ({})) {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      initiative: {
        active: true, round: 1, current_index: 0,
        order: [entry ?? { id: 'e1', token_id: 'tok-1', name: 'Toast' }],
      },
      tokens: new Map([['tok-1', token ?? { id: 'tok-1', name: 'Toast', sheet_id: 'chr-1' }]]),
      characters: new Map([['chr-1', character ?? {
        id: 'chr-1', name: 'Toast',
        cliches: { cliche1: 'Swashbuckler', cliche2: 'Hacker' },
        attributes: { cliche1: 4, cliche2: 3, cliche3: 0, cliche4: 0, cliche5: 0, cliche6: 0 },
      }]]),
      npcs: new Map(),
      settings: { systemConfig },
      items: new Map(),
      spells: new Map(),
    },
    _isMyCombatTurn: () => true,
    rollAttributeCheck: vi.fn(),
    toggleCombatAction: vi.fn(),
    nextTurn: vi.fn(),
    _calcModifier: (v) => v,
  });
}

describe('CombatTab per-ruleset behavior', () => {
  beforeEach(() => {
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [] };
    tokensSignal.value = new Map();
  });
  afterEach(() => cleanup());

  it('shows the named clichés as rollable actions for slot-paired systems', () => {
    const ui = makeUi(risus);
    const { container } = render(h(CombatTab, { ui }));
    expect(container.textContent).toContain('Clichés');
    expect(container.textContent).toContain('Swashbuckler');
    const card = [...container.querySelectorAll('.ab')]
      .find((el) => el.textContent.includes('Swashbuckler'));
    card.click();
    expect(ui.rollAttributeCheck).toHaveBeenCalledWith('Swashbuckler', 4);
  });

  it('hides the action-economy row when the ruleset declares none', () => {
    const ui = makeUi(risus);
    const { container } = render(h(CombatTab, { ui }));
    expect(container.textContent).not.toContain('Action economy');
    expect(container.querySelector('.combat-economy-pip')).toBeFalsy();
  });

  it('keeps the economy pips and skips the cliché section for d20 systems', () => {
    const ui = makeUi(dnd5e, {
      character: { id: 'chr-1', name: 'Aria', attributes: { str: 10 } },
      entry: { id: 'e1', token_id: 'tok-1', name: 'Aria', hp_current: 20, hp_max: 30 },
    });
    const { container } = render(h(CombatTab, { ui }));
    expect(container.textContent).toContain('Action economy');
    expect(container.textContent).not.toContain('Clichés');
  });

  it('omits the HP line when the entry has no hp fields', () => {
    const ui = makeUi(risus);
    const { container } = render(h(CombatTab, { ui }));
    expect(container.textContent).not.toContain('HP ?/?');
  });

  it('shows HP when the entry carries it', () => {
    const ui = makeUi(dnd5e, {
      entry: { id: 'e1', token_id: 'tok-1', name: 'Aria', hp_current: 20, hp_max: 30 },
    });
    const { container } = render(h(CombatTab, { ui }));
    expect(container.textContent).toContain('HP 20/30');
  });
});

describe('opposed rolls from the combat tab', () => {
  beforeEach(() => {
    initiativeSignal.value = { active: true, round: 1, current_index: 0, order: [] };
    tokensSignal.value = new Map();
  });

  it('rolling a cliché with an enemy selected announces an opposed result', async () => {
    const ui = makeUi(risus);
    ui.state.tokens.set('tok-bb', { id: 'tok-bb', name: 'Big Baddie', sheet_id: 'npc-1' });
    ui.state.npcs.set('npc-1', {
      id: 'npc-1', name: 'Big Baddie',
      cliches: { cliche1: 'BITE' }, attributes: { cliche1: 3 },
      stress: [false, false, false, false, false, false],
    });
    ui.state.selectedToken = 'tok-bb';
    ui.state.updateToken = vi.fn().mockResolvedValue(undefined);
    ui.state.updateNPC = vi.fn().mockResolvedValue(undefined);
    ui.state.updateCharacter = vi.fn().mockResolvedValue(undefined);
    ui.chat = { announceMessage: vi.fn().mockResolvedValue(undefined) };
    ui._log = vi.fn();

    const { container } = render(h(CombatTab, { ui }));
    const card = [...container.querySelectorAll('.ab')]
      .find((el) => el.textContent.includes('Swashbuckler'));
    card.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(ui.rollAttributeCheck).not.toHaveBeenCalled();
    const announced = ui.chat.announceMessage.mock.calls[0][0];
    expect(announced).toContain('Swashbuckler');
    expect(announced).toContain('BITE');
  });

  it('rolling without a selection stays a plain check', () => {
    const ui = makeUi(risus);
    ui.state.selectedToken = null;
    const { container } = render(h(CombatTab, { ui }));
    const card = [...container.querySelectorAll('.ab')]
      .find((el) => el.textContent.includes('Swashbuckler'));
    card.click();
    expect(ui.rollAttributeCheck).toHaveBeenCalledWith('Swashbuckler', 4);
  });
});

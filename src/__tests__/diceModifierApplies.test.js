/**
 * The composer strip reads d4 d6 d8 d10 d12 d20 | mod [_] | Roll, and
 * the mod field did nothing: `ui.rollDice` passed a literal 0 to
 * `fireRoll`, and so did advantage and disadvantage. The one
 * modifier-aware entry point, `handleDiceRoll`, had no caller anywhere
 * in the app.
 *
 * A number typed into a field beside a Roll button has to reach the
 * roll, whichever of those buttons is pressed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachCombatMethods } from '../ui/combat-wiring.js';
import { currentDiceModifier } from '../ui/dice-helpers.js';
import { VTT_EVENTS } from '../utils/constants.js';
import { DiceRoller } from '../dice-roller.js';

function pickDie(dice) {
  const btn = document.createElement('button');
  btn.setAttribute('data-dice', dice);
  btn.className = 'dbt--active';
  document.body.appendChild(btn);
  return btn;
}

function setModifier(value) {
  const input = document.createElement('input');
  input.id = 'dice-modifier';
  input.value = String(value);
  document.body.appendChild(input);
  return input;
}

function makeUi() {
  return /** @type {any} */ ({
    _toast: vi.fn(),
    diceRoller: new DiceRoller(),
    state: { settings: { systemConfig: {} } },
  });
}

function lastRoll(spy) {
  return spy.mock.calls.at(-1)?.[0]?.detail ?? null;
}

describe('the mod field reaches the roll', () => {
  let spy;
  beforeEach(() => {
    document.body.innerHTML = '';
    spy = vi.fn();
    window.addEventListener(VTT_EVENTS.DICE_ROLL_RESULT, spy);
  });
  afterEach(() => {
    window.removeEventListener(VTT_EVENTS.DICE_ROLL_RESULT, spy);
    document.body.innerHTML = '';
  });

  it('reads the field, defaulting to zero when it is absent or junk', () => {
    expect(currentDiceModifier()).toBe(0);
    const input = setModifier('3');
    expect(currentDiceModifier()).toBe(3);
    input.value = '-2';
    expect(currentDiceModifier()).toBe(-2);
    input.value = 'abc';
    expect(currentDiceModifier()).toBe(0);
  });

  it('applies to the Roll button', () => {
    setModifier(3);
    const ui = makeUi();
    attachCombatMethods(ui);
    ui.rollDice('d20');
    expect(lastRoll(spy).modifiers).toBe(3);
    expect(lastRoll(spy).expression).toBe('1d20+3');
  });

  it('applies to advantage and disadvantage', () => {
    setModifier(2);
    const ui = makeUi();
    attachCombatMethods(ui);
    ui.rollWithAdvantage();
    expect(lastRoll(spy).expression).toBe('2d20kh1+2');
    expect(lastRoll(spy).modifiers).toBe(2);
    ui.rollWithDisadvantage();
    expect(lastRoll(spy).expression).toBe('2d20kl1+2');
  });

  // The roll templates are written both ways: dnd5e.json spells
  // advantage "2d20kh1+{bonus}" while the substitution signs the value,
  // which produced "2d20kh1++2". That threw, and fireFormulaRoll's catch
  // quietly rolled a plain 1d20 instead - so advantage and disadvantage
  // had never actually kept the higher or lower die.
  it('reads a roll template whichever side of {bonus} carries the sign', () => {
    const ui = makeUi();
    ui.state.settings.systemConfig.rolls = { advantage: '3d6kh1{bonus}' };
    attachCombatMethods(ui);
    setModifier(-3);
    ui.rollWithAdvantage();
    expect(lastRoll(spy).expression).toBe('3d6kh1-3');
  });

  it('keeps the higher die with no modifier at all', () => {
    const ui = makeUi();
    attachCombatMethods(ui);
    ui.rollWithAdvantage();
    expect(lastRoll(spy).expression).toBe('2d20kh1+0');
    expect(lastRoll(spy).results).toHaveLength(2);
  });

  it('falls back to the die the strip shows as active', () => {
    pickDie('d8');
    setModifier(1);
    const ui = makeUi();
    attachCombatMethods(ui);
    ui.rollDice();
    expect(lastRoll(spy).expression).toBe('1d8+1');
  });

  it('does nothing when no die is picked and none is named', () => {
    const ui = makeUi();
    attachCombatMethods(ui);
    ui.rollDice();
    expect(spy).not.toHaveBeenCalled();
  });
});

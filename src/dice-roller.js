/**
 * DiceRoller - thin adapter over the engine's generic notation roller.
 *
 * Preserves the legacy `{formula, rolls, modifier, result}` shape that
 * chat-integrator, combat-manager, attack-modal, and dice-helpers depend
 * on, while gaining support for NdF (FATE), NdS! (exploding), and
 * NdSkhK/NdSklK (advantage/disadvantage) via the engine grammar.
 */

import { rollNotation } from './engine/roll.js';

export class DiceRoller {
  constructor(state = null) {
    this.state = state;
  }

  roll(formula) {
    if (typeof formula !== 'string' || formula.length === 0) {
      throw new Error(`Invalid dice formula: ${formula}`);
    }
    let out;
    try {
      out = rollNotation(formula, { rng: () => Math.random() });
    } catch (err) {
      const msg = err?.message ?? '';
      if (/count out of range/.test(msg)) throw new Error('Too many dice', { cause: err });
      if (/die sides out of range/.test(msg)) throw new Error('Invalid die sides', { cause: err });
      throw new Error(`Invalid dice formula: ${formula}`, { cause: err });
    }
    return {
      formula,
      rolls: out.rolls,
      modifier: out.modifier,
      result: out.total,
    };
  }

  rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  rollWithAdvantage(sides, modifier = 0) {
    const r1 = this.rollDie(sides);
    const r2 = this.rollDie(sides);
    const kept = Math.max(r1, r2);
    return { rolls: [r1, r2], kept, modifier, result: kept + modifier };
  }

  rollWithDisadvantage(sides, modifier = 0) {
    const r1 = this.rollDie(sides);
    const r2 = this.rollDie(sides);
    const kept = Math.min(r1, r2);
    return { rolls: [r1, r2], kept, modifier, result: kept + modifier };
  }
}

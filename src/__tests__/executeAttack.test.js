/**
 * executeAttack - automated attack resolution (roll to-hit, roll damage
 * on a hit, route the total through an injected damage-audit callback).
 *
 * The RNG is injected so rolls are deterministic; see engineRoll.test.js
 * for the same seqRng convention.
 */

import { describe, it, expect, vi } from 'vitest';
import { executeAttack } from '../ui/execute-attack.js';
import { VTT_EVENTS } from '../utils/constants.js';

function seqRng(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

const dnd5eLikeRuleset = {
  harm_model: { type: 'pool', track_key: 'hp' },
  rolls: { attack: '1d20+{bonus}' },
  combat: { defenseKey: 'ac', critThreshold: 20, fumbleThreshold: 1 },
};

function collectDiceEvents() {
  const events = [];
  const handler = (e) => events.push(e.detail);
  window.addEventListener(VTT_EVENTS.DICE_ROLL_RESULT, handler);
  return { events, stop: () => window.removeEventListener(VTT_EVENTS.DICE_ROLL_RESULT, handler) };
}

describe('executeAttack', () => {
  it('rolls to hit, rolls damage, and applies it through the injected audit callback on a hit', async () => {
    const { events, stop } = collectDiceEvents();
    const applyDamage = vi.fn().mockResolvedValue(undefined);
    const rng = seqRng([0.5]); // 1d20 → 11 (+5 = 16 ≥ AC 14); 1d6 → 4 (+2 = 6)

    const result = await executeAttack({
      ruleset: dnd5eLikeRuleset,
      action: { name: 'Sword', attack_bonus: 5, damage: '1d6+2', damage_type: 'slashing' },
      target: { ac: 14 },
      attackerName: 'Fighter',
      targetName: 'Goblin',
      rng,
      applyDamage,
    });

    stop();
    expect(result.hit).toBe(true);
    expect(result.crit).toBe(false);
    expect(result.damage).toBe(6);
    expect(applyDamage).toHaveBeenCalledWith(6, { crit: false, damageType: 'slashing' });
    expect(events).toHaveLength(2);
    expect(events[0].total).toBe(16);
    expect(events[1].total).toBe(6);
  });

  it('reports a miss and does not roll or apply damage when the total is below defense', async () => {
    const { events, stop } = collectDiceEvents();
    const applyDamage = vi.fn();
    const rng = seqRng([0.05]); // 1d20 → 2 (+0 = 2 < AC 18)

    const result = await executeAttack({
      ruleset: dnd5eLikeRuleset,
      action: { name: 'Sword', attack_bonus: 0, damage: '1d6' },
      target: { ac: 18 },
      rng,
      applyDamage,
    });

    stop();
    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
    expect(applyDamage).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it('doubles damage dice and hits automatically on a natural-20 critical', async () => {
    const applyDamage = vi.fn().mockResolvedValue(undefined);
    const rng = seqRng([0.99, 0.5, 0.5]); // 1d20 → 20 (crit); 2d6 (doubled) → 4,4

    const result = await executeAttack({
      ruleset: dnd5eLikeRuleset,
      action: { name: 'Dagger', attack_bonus: 5, damage: '1d6+2', damage_type: 'piercing' },
      target: { ac: 10 },
      rng,
      applyDamage,
    });

    expect(result.hit).toBe(true);
    expect(result.crit).toBe(true);
    expect(result.damageRoll.notation).toBe('2d6+2');
    expect(result.damage).toBe(10);
    expect(applyDamage).toHaveBeenCalledWith(10, { crit: true, damageType: 'piercing' });
  });

  it('fumbles on the ruleset fumble threshold regardless of bonus', async () => {
    const applyDamage = vi.fn();
    const rng = seqRng([0.0]); // 1d20 → 1 (fumble threshold)

    const result = await executeAttack({
      ruleset: dnd5eLikeRuleset,
      action: { attack_bonus: 20, damage: '1d6' },
      target: { ac: 5 },
      rng,
      applyDamage,
    });

    expect(result.hit).toBe(false);
    expect(result.fumble).toBe(true);
    expect(applyDamage).not.toHaveBeenCalled();
  });

  it('skips crit/fumble handling entirely when the ruleset does not declare thresholds', async () => {
    const ruleset = {
      harm_model: { type: 'pool', track_key: 'hp' },
      rolls: { attack: '1d20+{bonus}' },
      combat: {},
    };
    const rng = seqRng([0.99]); // natural 20, but no critThreshold declared

    const result = await executeAttack({
      ruleset,
      action: { attack_bonus: 0, damage: '1d6' },
      target: { ac: 100 },
      rng,
      applyDamage: vi.fn(),
    });

    expect(result.crit).toBe(false);
    expect(result.hit).toBe(false); // natural 20 alone doesn't auto-hit without a declared crit rule
  });

  it('is a no-op returning null for a ruleset with no harm_model (no attack semantics)', async () => {
    const { events, stop } = collectDiceEvents();
    const applyDamage = vi.fn();

    const result = await executeAttack({
      ruleset: { rolls: { attack: '1d20+{bonus}' }, combat: {} },
      action: { attack_bonus: 5, damage: '1d6' },
      target: { ac: 10 },
      applyDamage,
    });

    stop();
    expect(result).toBeNull();
    expect(applyDamage).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it('is a no-op returning null when no action is given', async () => {
    const result = await executeAttack({ ruleset: dnd5eLikeRuleset, target: { ac: 10 } });
    expect(result).toBeNull();
  });
});

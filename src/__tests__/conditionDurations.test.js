/**
 * tickConditionDurations - condition auto-expiry on turn advancement
 *
 * Conditions with a duration in token.condition_durations are decremented
 * each round. When duration reaches 0 the condition is removed from both
 * token.conditions and token.condition_durations.
 *
 * Plain string conditions without a duration entry never expire.
 */

import { describe, it, expect } from 'vitest';
import { tickConditionDurations } from '../map/actions/combat.js';

function makeToken(conditions, durations = {}) {
  return {
    conditions: [...conditions],
    condition_durations: { ...durations },
  };
}

describe('tickConditionDurations', () => {
  it('decrements duration_rounds for each tracked condition', () => {
    const token = makeToken(['poisoned'], { poisoned: { duration_rounds: 3, applied_round: 1 } });
    const expired = tickConditionDurations(token, 2);
    expect(token.condition_durations.poisoned.duration_rounds).toBe(2);
    expect(expired).toEqual([]);
  });

  it('removes condition when duration reaches 0', () => {
    const token = makeToken(['stunned'], { stunned: { duration_rounds: 1, applied_round: 1 } });
    const expired = tickConditionDurations(token, 2);
    expect(token.conditions).not.toContain('stunned');
    expect(token.condition_durations).not.toHaveProperty('stunned');
    expect(expired).toContain('stunned');
  });

  it('does not expire conditions without a duration entry', () => {
    const token = makeToken(['blinded']);
    const expired = tickConditionDurations(token, 5);
    expect(token.conditions).toContain('blinded');
    expect(expired).toEqual([]);
  });

  it('handles multiple conditions - only expires those at 0', () => {
    const token = makeToken(['poisoned', 'prone', 'burning'], {
      poisoned: { duration_rounds: 1, applied_round: 1 },
      burning:  { duration_rounds: 3, applied_round: 1 },
    });
    const expired = tickConditionDurations(token, 2);
    expect(expired).toContain('poisoned');
    expect(token.conditions).not.toContain('poisoned');
    expect(token.conditions).toContain('burning');
    expect(token.conditions).toContain('prone'); // no duration
    expect(token.condition_durations.burning.duration_rounds).toBe(2);
  });

  it('returns empty array and mutates nothing when no durations tracked', () => {
    const token = makeToken(['charmed', 'grappled']);
    const before = [...token.conditions];
    const expired = tickConditionDurations(token, 1);
    expect(expired).toEqual([]);
    expect(token.conditions).toEqual(before);
  });
});

/**
 * showConditionDialog - Save Conditions should write both
 * `conditions` and the matching `condition_durations` map for any
 * row where the duration input is > 0. Previously durations were
 * tracked-but-never-set, so `tickConditionDurations` was a no-op in
 * practice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showConditionDialog } from '../map/actions/combat.js';

function makeMr(token = { id: 'tok-1', name: 'Goblin', conditions: [], condition_durations: {} }) {
  const updateToken = vi.fn().mockResolvedValue(true);
  return {
    state: {
      tokens: new Map([[token.id, token]]),
      updateToken,
    },
    token,
    updateToken,
  };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('showConditionDialog - duration input', () => {
  it('renders a duration input next to each condition checkbox', () => {
    const mr = makeMr();
    showConditionDialog(mr, 'tok-1');
    // One number input per condition row
    const durationInputs = document.querySelectorAll('input.cond-duration');
    expect(durationInputs.length).toBeGreaterThan(0);
    // Each row pairs a .cond-check + .cond-duration via shared name/value
    const firstCheck = document.querySelector('.cond-check');
    const firstDur = document.querySelector('.cond-duration');
    expect(firstCheck.value).toBe(firstDur.dataset.condition);
  });

  it('Save writes conditions[] AND condition_durations{} for checked rows with duration > 0', async () => {
    const mr = makeMr();
    showConditionDialog(mr, 'tok-1');

    // Check "poisoned" with duration 3, "stunned" with duration 0 (no expiry)
    const poisonedCheck = document.querySelector('.cond-check[value="poisoned"]');
    const poisonedDur = document.querySelector('.cond-duration[data-condition="poisoned"]');
    const stunnedCheck = document.querySelector('.cond-check[value="stunned"]');

    poisonedCheck.checked = true;
    poisonedDur.value = '3';
    stunnedCheck.checked = true;

    document.getElementById('cond-apply-btn').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(mr.updateToken).toHaveBeenCalled();
    const [, patch] = mr.updateToken.mock.calls[0];
    expect(patch.conditions).toEqual(expect.arrayContaining(['poisoned', 'stunned']));
    expect(patch.condition_durations).toEqual({
      poisoned: { duration_rounds: 3 },
    });
  });

  it('duration <= 0 or blank does not enter condition_durations', async () => {
    const mr = makeMr();
    showConditionDialog(mr, 'tok-1');
    const charm = document.querySelector('.cond-check[value="charmed"]');
    const charmDur = document.querySelector('.cond-duration[data-condition="charmed"]');
    charm.checked = true;
    charmDur.value = '0';
    document.getElementById('cond-apply-btn').click();
    await Promise.resolve();
    await Promise.resolve();
    const [, patch] = mr.updateToken.mock.calls[0];
    expect(patch.conditions).toContain('charmed');
    expect(patch.condition_durations.charmed).toBeUndefined();
  });

  it('duration inputs are disabled when their checkbox is unchecked', () => {
    const mr = makeMr();
    showConditionDialog(mr, 'tok-1');
    // No conditions on this token yet - all checkboxes off → all duration
    // inputs disabled.
    const durations = document.querySelectorAll('.cond-duration');
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) {
      expect(d.disabled).toBe(true);
    }
  });

  it('checking a condition enables its duration input', () => {
    const mr = makeMr();
    showConditionDialog(mr, 'tok-1');
    const poisonedCheck = document.querySelector('.cond-check[value="poisoned"]');
    const poisonedDur = document.querySelector('.cond-duration[data-condition="poisoned"]');
    expect(poisonedDur.disabled).toBe(true);
    poisonedCheck.checked = true;
    poisonedCheck.dispatchEvent(new Event('change', { bubbles: true }));
    expect(poisonedDur.disabled).toBe(false);
  });

  it('unchecking a previously-durational condition clears its duration', async () => {
    const token = {
      id: 'tok-1', name: 'Goblin',
      conditions: ['poisoned'],
      condition_durations: { poisoned: { duration_rounds: 5 } },
    };
    const mr = makeMr(token);
    showConditionDialog(mr, 'tok-1');
    // Prefill: the existing duration should be visible
    const poisonedDur = document.querySelector('.cond-duration[data-condition="poisoned"]');
    expect(poisonedDur.value).toBe('5');
    // Now uncheck poisoned
    document.querySelector('.cond-check[value="poisoned"]').checked = false;
    document.getElementById('cond-apply-btn').click();
    await Promise.resolve();
    await Promise.resolve();
    const [, patch] = mr.updateToken.mock.calls[0];
    expect(patch.conditions).not.toContain('poisoned');
    expect(patch.condition_durations.poisoned).toBeUndefined();
  });
});

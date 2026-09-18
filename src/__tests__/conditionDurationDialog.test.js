/**
 * showConditionDialog - Save Conditions writes both `conditions` and
 * the matching `condition_durations` map for any row given a rounds
 * value > 0. Durations were once tracked-but-never-set, which made
 * `tickConditionDurations` a no-op in practice.
 *
 * A row's rounds field exists only while that row is ticked, so these
 * drive the checkbox first and then the field.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import { showConditionDialog } from '../map/actions/combat.js';
import dnd5e from '../content/rulesets/dnd5e.json';

function makeMr(token = { id: 'tok-1', name: 'Goblin', conditions: [], condition_durations: {} }) {
  const updateToken = vi.fn().mockResolvedValue(true);
  return /** @type {any} */ ({
    state: {
      tokens: new Map([[token.id, token]]), updateToken,
      settings: { systemConfig: { conditions: dnd5e.conditions } },
    },
    token,
    updateToken,
  });
}

const check = (cond) => fireEvent.click(document.querySelector(`.cond-check[value="${cond}"]`));
const setRounds = (cond, value) =>
  fireEvent.input(document.querySelector(`.cond-duration[data-condition="${cond}"]`), { target: { value } });
const save = async () => {
  document.getElementById('cond-apply-btn').click();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('showConditionDialog - duration input', () => {
  it('gives a ticked row a rounds field and leaves unticked rows without one', () => {
    showConditionDialog(makeMr(), 'tok-1');
    expect(document.querySelectorAll('.cond-duration')).toHaveLength(0);
    check('poisoned');
    const durations = document.querySelectorAll('.cond-duration');
    expect(durations).toHaveLength(1);
    expect(/** @type {HTMLElement} */ (durations[0]).dataset.condition).toBe('poisoned');
  });

  it('Save writes conditions[] AND condition_durations{} for rows with rounds > 0', async () => {
    const mr = makeMr();
    showConditionDialog(mr, 'tok-1');
    check('poisoned');
    setRounds('poisoned', '3');
    check('stunned');
    await save();

    expect(mr.updateToken).toHaveBeenCalled();
    const [, patch] = mr.updateToken.mock.calls[0];
    expect(patch.conditions).toEqual(expect.arrayContaining(['poisoned', 'stunned']));
    expect(patch.condition_durations).toEqual({ poisoned: { duration_rounds: 3 } });
  });

  it('rounds of 0 or blank does not enter condition_durations', async () => {
    const mr = makeMr();
    showConditionDialog(mr, 'tok-1');
    check('charmed');
    setRounds('charmed', '0');
    await save();
    const [, patch] = mr.updateToken.mock.calls[0];
    expect(patch.conditions).toContain('charmed');
    expect(patch.condition_durations.charmed).toBeUndefined();
  });

  it('prefills an existing duration and clears it when the row is unticked', async () => {
    const token = {
      id: 'tok-1', name: 'Goblin',
      conditions: ['poisoned'],
      condition_durations: { poisoned: { duration_rounds: 5 } },
    };
    const mr = makeMr(token);
    showConditionDialog(mr, 'tok-1');
    expect(document.querySelector('.cond-duration[data-condition="poisoned"]').value).toBe('5');

    check('poisoned');
    await save();
    const [, patch] = mr.updateToken.mock.calls[0];
    expect(patch.conditions).not.toContain('poisoned');
    expect(patch.condition_durations.poisoned).toBeUndefined();
  });
});

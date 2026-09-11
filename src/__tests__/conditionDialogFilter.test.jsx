/**
 * The densest dialog in the app: fifteen conditions times a checkbox
 * plus a rounds input, 32 controls in a 420px modal, with fourteen of
 * the fifteen rounds inputs permanently disabled. A filter narrows the
 * list, and a row's rounds input appears only once that row is ticked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import { showConditionDialog } from '../map/actions/combat.js';

function makeMr(token) {
  return /** @type {any} */ ({
    state: {
      tokens: new Map([[token.id, token]]),
      updateToken: vi.fn().mockResolvedValue(undefined),
      isGM: () => true,
      settings: { systemConfig: {} },
      characters: new Map(), spells: new Map(),
    },
    render: vi.fn(),
  });
}

const token = { id: 't1', name: 'Aria', conditions: [], condition_durations: {} };

function rows() {
  return [...document.querySelectorAll('.cond-grid__label')];
}

describe('condition dialog', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows a checkbox per condition and no rounds input until one is ticked', () => {
    showConditionDialog(makeMr(token), 't1');
    expect(rows().length).toBeGreaterThan(10);
    expect(document.querySelectorAll('.cond-duration').length).toBe(0);
  });

  it('reveals the rounds input for the row that was ticked, and only that row', () => {
    showConditionDialog(makeMr(token), 't1');
    const first = document.querySelector('.cond-check');
    fireEvent.click(first);
    const durations = [...document.querySelectorAll('.cond-duration')];
    expect(durations).toHaveLength(1);
    expect(durations[0].getAttribute('data-condition')).toBe(first.getAttribute('value'));
    expect(durations[0].disabled).toBe(false);
  });

  it('filters the list as you type', () => {
    showConditionDialog(makeMr(token), 't1');
    const filter = document.querySelector('#cond-filter');
    expect(filter).not.toBeNull();
    fireEvent.input(filter, { target: { value: 'blind' } });
    const labels = rows().map((l) => l.textContent.trim().toLowerCase());
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => l.includes('blind'))).toBe(true);
  });

  it('never filters away a condition the token already has', () => {
    const withCond = { ...token, conditions: ['poisoned'] };
    showConditionDialog(makeMr(withCond), 't1');
    fireEvent.input(document.querySelector('#cond-filter'), { target: { value: 'blind' } });
    const labels = rows().map((l) => l.textContent.trim().toLowerCase());
    expect(labels.some((l) => l.includes('poisoned'))).toBe(true);
  });

  it('saves the ticked conditions with their rounds', async () => {
    const mr = makeMr(token);
    showConditionDialog(mr, 't1');
    const first = document.querySelector('.cond-check');
    fireEvent.click(first);
    fireEvent.input(document.querySelector('.cond-duration'), { target: { value: '3' } });
    document.querySelector('#cond-apply-btn').click();
    await new Promise((r) => setTimeout(r, 0));
    const [, patch] = mr.state.updateToken.mock.calls[0];
    expect(patch.conditions).toEqual([first.getAttribute('value')]);
    expect(patch.condition_durations[first.getAttribute('value')]).toEqual({ duration_rounds: 3 });
  });
});

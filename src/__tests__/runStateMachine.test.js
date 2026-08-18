/**
 * Generic state-machine runner. The ruleset declares a transition spec;
 * the engine applies it to a state + input and returns the new state.
 *
 * Spec shape:
 *   {
 *     transitions: [
 *       { when: <formula>, set: { <field>: <formula>, ... } },
 *       ...
 *     ],
 *     resolve: { <field>: <formula>, ... }   // post-transition derivations
 *   }
 *
 * Evaluation context during each formula: { state, input, ...extras }.
 * Transitions are checked in order; first matching `when` wins.
 */

import { describe, it, expect } from 'vitest';
import { runStateMachine } from '../engine/runStateMachine.js';

// Death save FSM expressed purely as data
const deathSaveSpec = {
  transitions: [
    {
      when: { $: 'eq', args: ['@input.roll', 20] },
      set: { successes: 0, failures: 0, status: 'revive' },
    },
    {
      when: { $: 'eq', args: ['@input.roll', 1] },
      set: { failures: { $: '+', args: ['@state.failures', 2] } },
    },
    {
      when: { $: 'gt', args: ['@input.roll', 9] },
      set: { successes: { $: '+', args: ['@state.successes', 1] } },
    },
    {
      when: true,
      set: { failures: { $: '+', args: ['@state.failures', 1] } },
    },
  ],
  resolve: {
    status: {
      $: 'if',
      args: [
        { $: 'gt', args: ['@state.failures', 2] }, 'dead',
        {
          $: 'if',
          args: [
            { $: 'gt', args: ['@state.successes', 2] }, 'stable',
            '@state.status',
          ],
        },
      ],
    },
  },
};

const fresh = () => ({ successes: 0, failures: 0, status: 'rolling' });

describe('runStateMachine - death save spec (integration)', () => {
  it('roll ≥ 10 adds a success', () => {
    const out = runStateMachine(deathSaveSpec, fresh(), { roll: 15 });
    expect(out.successes).toBe(1);
    expect(out.failures).toBe(0);
    expect(out.status).toBe('rolling');
  });

  it('roll 2-9 adds a failure', () => {
    const out = runStateMachine(deathSaveSpec, fresh(), { roll: 5 });
    expect(out.failures).toBe(1);
  });

  it('nat 1 adds two failures', () => {
    const out = runStateMachine(deathSaveSpec, fresh(), { roll: 1 });
    expect(out.failures).toBe(2);
  });

  it('nat 20 resets + marks revive', () => {
    const out = runStateMachine(deathSaveSpec, { successes: 1, failures: 2, status: 'rolling' }, { roll: 20 });
    expect(out.status).toBe('revive');
    expect(out.successes).toBe(0);
    expect(out.failures).toBe(0);
  });

  it('3 successes resolves to stable', () => {
    let s = fresh();
    s = runStateMachine(deathSaveSpec, s, { roll: 10 });
    s = runStateMachine(deathSaveSpec, s, { roll: 10 });
    s = runStateMachine(deathSaveSpec, s, { roll: 10 });
    expect(s.status).toBe('stable');
  });

  it('3 failures resolves to dead', () => {
    let s = fresh();
    s = runStateMachine(deathSaveSpec, s, { roll: 5 });
    s = runStateMachine(deathSaveSpec, s, { roll: 5 });
    s = runStateMachine(deathSaveSpec, s, { roll: 5 });
    expect(s.status).toBe('dead');
  });
});

describe('runStateMachine - safety', () => {
  it('returns state unchanged when spec is missing', () => {
    const state = { x: 1 };
    expect(runStateMachine(null, state, {})).toEqual(state);
    expect(runStateMachine({}, state, {})).toEqual(state);
  });

  it('skips transitions whose "when" does not match', () => {
    const spec = {
      transitions: [
        { when: false, set: { x: 99 } },
        { when: true,  set: { x: 42 } },
      ],
    };
    expect(runStateMachine(spec, { x: 0 }, {}).x).toBe(42);
  });

  it('does not mutate input state', () => {
    const state = fresh();
    runStateMachine(deathSaveSpec, state, { roll: 15 });
    expect(state).toEqual(fresh());
  });

  it('works with a simple 2-state toggle (generic proof)', () => {
    const toggle = {
      transitions: [
        { when: { $: 'eq', args: ['@state.on', true] },  set: { on: false } },
        { when: true,                                      set: { on: true } },
      ],
    };
    let s = { on: false };
    s = runStateMachine(toggle, s, {});
    expect(s.on).toBe(true);
    s = runStateMachine(toggle, s, {});
    expect(s.on).toBe(false);
  });
});

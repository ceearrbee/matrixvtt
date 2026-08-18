/**
 * Generic state-machine runner driven by evaluator formulas.
 *
 * Spec:
 *   {
 *     transitions: [ { when: <formula>, set: { field: <formula>, ... } } ],
 *     resolve:     { field: <formula>, ... }
 *   }
 *
 * Context passed to every formula: { state, input, ...extras }.
 * First matching `when` wins; its `set` block is applied; then the
 * `resolve` block runs against the updated state to derive summary
 * fields (e.g. a 'status' string from counter thresholds).
 *
 * Pure: input state is never mutated.
 */

import { evaluate } from './evaluate.js';

export function runStateMachine(spec, state, input = {}, extras = {}) {
  if (!spec?.transitions) return state;

  const ctx = () => ({ state: next, input, ...extras });
  let next = { ...state };

  for (const t of spec.transitions) {
    if (evaluate(t.when, ctx())) {
      for (const [field, formula] of Object.entries(t.set ?? {})) {
        next = { ...next, [field]: evaluate(formula, ctx()) };
      }
      break;
    }
  }

  for (const [field, formula] of Object.entries(spec.resolve ?? {})) {
    next = { ...next, [field]: evaluate(formula, ctx()) };
  }

  return next;
}

/**
 * Formula evaluator - the core of the generic rules engine.
 *
 * Formulas are JSON-AST: literals, objects with a single $op key, or
 * strings starting with `@` that resolve paths through the context.
 * No eval/new Function - the evaluator walks the tree itself so rulesets
 * can be imported from untrusted sources.
 */

import { describe, it, expect } from 'vitest';
import { evaluate } from '../engine/evaluate.js';

describe('evaluate - literals and variables', () => {
  it('returns numeric literals unchanged', () => {
    expect(evaluate(5, {})).toBe(5);
    expect(evaluate(0, {})).toBe(0);
    expect(evaluate(-3, {})).toBe(-3);
  });

  it('returns boolean and null literals unchanged', () => {
    expect(evaluate(true, {})).toBe(true);
    expect(evaluate(false, {})).toBe(false);
    expect(evaluate(null, {})).toBe(null);
  });

  it('returns plain strings that do not start with @', () => {
    expect(evaluate('hello', {})).toBe('hello');
    expect(evaluate('', {})).toBe('');
  });

  it('resolves @path references from context', () => {
    const ctx = { level: 5, attrs: { str: { mod: 3 } } };
    expect(evaluate('@level', ctx)).toBe(5);
    expect(evaluate('@attrs.str.mod', ctx)).toBe(3);
  });

  it('returns null for unresolved paths', () => {
    expect(evaluate('@missing', {})).toBeNull();
    expect(evaluate('@a.b.c', { a: {} })).toBeNull();
  });
});

describe('evaluate - arithmetic ops', () => {
  it('$+ sums its args', () => {
    expect(evaluate({ $: '+', args: [1, 2, 3] }, {})).toBe(6);
    expect(evaluate({ $: '+', args: [8, '@pb', '@mod'] }, { pb: 2, mod: 3 })).toBe(13);
  });

  it('$- subtracts', () => {
    expect(evaluate({ $: '-', args: [10, 3] }, {})).toBe(7);
    expect(evaluate({ $: '-', args: [10, 3, 2] }, {})).toBe(5);
  });

  it('$* multiplies', () => {
    expect(evaluate({ $: '*', args: [2, 3, 4] }, {})).toBe(24);
  });

  it('$/ divides left-to-right', () => {
    expect(evaluate({ $: '/', args: [20, 4] }, {})).toBe(5);
    expect(evaluate({ $: '/', args: [100, 5, 2] }, {})).toBe(10);
  });

  it('$floor and $ceil take a single arg', () => {
    expect(evaluate({ $: 'floor', args: [3.7] }, {})).toBe(3);
    expect(evaluate({ $: 'ceil', args: [3.1] }, {})).toBe(4);
  });

  it('$max and $min take variadic args', () => {
    expect(evaluate({ $: 'max', args: [1, 5, 3] }, {})).toBe(5);
    expect(evaluate({ $: 'min', args: [1, 5, 3] }, {})).toBe(1);
  });
});

describe('evaluate - comparisons and control flow', () => {
  it('$eq, $lt, $gt return booleans', () => {
    expect(evaluate({ $: 'eq', args: [2, 2] }, {})).toBe(true);
    expect(evaluate({ $: 'lt', args: [1, 2] }, {})).toBe(true);
    expect(evaluate({ $: 'gt', args: [1, 2] }, {})).toBe(false);
  });

  it('$if returns then when truthy, else otherwise', () => {
    expect(evaluate({ $: 'if', args: [true, 'a', 'b'] }, {})).toBe('a');
    expect(evaluate({ $: 'if', args: [false, 'a', 'b'] }, {})).toBe('b');
    expect(evaluate({ $: 'if', args: [{ $: 'eq', args: ['@x', 5] }, 'yes', 'no'] }, { x: 5 }))
      .toBe('yes');
  });
});

describe('evaluate - $lookup', () => {
  it('reads a value from a named table in context.tables', () => {
    const ctx = {
      level: 5,
      tables: { pb: { 1: 2, 5: 3, 17: 6 } },
    };
    expect(evaluate({ $: 'lookup', args: ['pb', '@level'] }, ctx)).toBe(3);
  });

  it('returns null when the table or key is missing', () => {
    expect(evaluate({ $: 'lookup', args: ['missing', 1] }, { tables: {} })).toBeNull();
    expect(evaluate({ $: 'lookup', args: ['pb', 99] }, { tables: { pb: { 1: 2 } } })).toBeNull();
  });
});

describe('evaluate - safety and composition', () => {
  it('refuses unknown operators by returning null', () => {
    expect(evaluate({ $: 'evil', args: [] }, {})).toBeNull();
  });

  it('composes deeply', () => {
    // 5e spell save DC: 8 + PB + mod, where PB comes from the level table
    const formula = {
      $: '+',
      args: [
        8,
        { $: 'lookup', args: ['pb', '@level'] },
        '@mod',
      ],
    };
    const ctx = { level: 5, mod: 4, tables: { pb: { 1: 2, 5: 3 } } };
    expect(evaluate(formula, ctx)).toBe(15);
  });

  it('handles nested @paths inside arithmetic', () => {
    const ctx = { a: { b: 10 }, c: 5 };
    expect(evaluate({ $: '-', args: ['@a.b', '@c'] }, ctx)).toBe(5);
  });
});

/**
 * Lock-in tests for `updateDiceResult` - writes to `ui._latestDiceResult`
 * which DiceBar.jsx injects via `dangerouslySetInnerHTML`. The label and
 * expression are user-authored; must route through `esc()`.
 */
import { describe, it, expect } from 'vitest';
import { updateDiceResult } from '../ui/state-updater.js';

describe('updateDiceResult escape contract', () => {
  it('escapes XSS-shaped labels', () => {
    const ui = {};
    updateDiceResult(ui, {
      expression: '1d20',
      results: [15], modifiers: 0, total: 15,
      label: '<script>alert(1)</script>',
    });
    expect(ui._latestDiceResult).not.toContain('<script>');
    expect(ui._latestDiceResult).toContain('&lt;script&gt;');
  });

  it('escapes XSS-shaped expressions', () => {
    const ui = {};
    updateDiceResult(ui, {
      expression: '"><img src=x>',
      results: [10], modifiers: 0, total: 10,
    });
    expect(ui._latestDiceResult).not.toContain('"><img');
    expect(ui._latestDiceResult).toContain('&quot;&gt;&lt;img');
  });
});

/**
 * updateDiceResult - Adv / Dis rendering pins the kept die and visibly
 * drops the discarded die. Before this fix the renderer did
 * `results.join(' + ')` which printed "17 + 9 = 17" - misleading,
 * suggests the 9 was added.
 *
 * Detection: a roll labelled "Advantage" with 2 results → kept is the
 * MAX; "Disadvantage" → kept is the MIN. The kept span gets
 * `.dice-result__kept`, the dropped span `.dice-result__dropped`.
 */
import { describe, it, expect } from 'vitest';
import { updateDiceResult } from '../ui/state-updater.js';

describe('updateDiceResult - advantage / disadvantage', () => {
  it('Advantage with [17, 9]: kept=17, dropped=9', () => {
    const ui = {};
    updateDiceResult(ui, {
      expression: '2d20kh1',
      results: [17, 9],
      modifiers: 3,
      total: 20,
      label: 'Advantage',
    });
    expect(ui._latestDiceResult).toMatch(/dice-result__kept[^>]*>17</);
    expect(ui._latestDiceResult).toMatch(/dice-result__dropped[^>]*>9</);
    expect(ui._latestDiceResult).toContain('20'); // total
  });

  it('Disadvantage with [17, 9]: kept=9, dropped=17', () => {
    const ui = {};
    updateDiceResult(ui, {
      expression: '2d20kl1',
      results: [17, 9],
      modifiers: 0,
      total: 9,
      label: 'Disadvantage',
    });
    expect(ui._latestDiceResult).toMatch(/dice-result__kept[^>]*>9</);
    expect(ui._latestDiceResult).toMatch(/dice-result__dropped[^>]*>17</);
  });

  it('Standard 1d20 rolls fall through to the plain join (no kept/dropped spans)', () => {
    const ui = {};
    updateDiceResult(ui, {
      expression: '1d20',
      results: [14],
      modifiers: 0,
      total: 14,
      label: '',
    });
    expect(ui._latestDiceResult).not.toContain('dice-result__kept');
    expect(ui._latestDiceResult).not.toContain('dice-result__dropped');
    expect(ui._latestDiceResult).toContain('14');
  });

  it('Adv with equal rolls: one is marked kept, one dropped (no crash)', () => {
    const ui = {};
    updateDiceResult(ui, {
      expression: '2d20kh1',
      results: [12, 12],
      modifiers: 0,
      total: 12,
      label: 'Advantage',
    });
    // Just assert both spans exist; which 12 is "kept" vs "dropped"
    // doesn't matter mechanically.
    expect(ui._latestDiceResult).toContain('dice-result__kept');
    expect(ui._latestDiceResult).toContain('dice-result__dropped');
  });
});

/**
 * Keyboard token selection: N / Shift+N cycles tokens on the active
 * map in reading order (row, then col), so keyboard and screen-reader
 * users can acquire a token without the pointer. Closes the gap where
 * keyboard movement (M + arrows) existed but selection required a
 * mouse click.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { cycleTokenId, announceTokenSelection } from '../map/token-cycle.js';

const TOKENS = new Map([
  ['b', { id: 'b', name: 'Bandit', map_id: 'm1', col: 3, row: 1 }],
  ['a', { id: 'a', name: 'Aria', map_id: 'm1', col: 1, row: 1 }],
  ['c', { id: 'c', name: 'Cleric', map_id: 'm1', col: 2, row: 4 }],
  ['x', { id: 'x', name: 'Elsewhere', map_id: 'm2', col: 0, row: 0 }],
]);

describe('cycleTokenId', () => {
  it('starts at the first token in reading order when nothing is selected', () => {
    expect(cycleTokenId({ tokens: TOKENS, activeMapId: 'm1', currentId: null, dir: 1 })).toBe('a');
  });

  it('cycles forward in reading order and wraps', () => {
    expect(cycleTokenId({ tokens: TOKENS, activeMapId: 'm1', currentId: 'a', dir: 1 })).toBe('b');
    expect(cycleTokenId({ tokens: TOKENS, activeMapId: 'm1', currentId: 'b', dir: 1 })).toBe('c');
    expect(cycleTokenId({ tokens: TOKENS, activeMapId: 'm1', currentId: 'c', dir: 1 })).toBe('a');
  });

  it('cycles backward with dir=-1', () => {
    expect(cycleTokenId({ tokens: TOKENS, activeMapId: 'm1', currentId: 'a', dir: -1 })).toBe('c');
  });

  it('only cycles tokens on the active map', () => {
    const ids = ['a', 'b', 'c'].map((id) =>
      cycleTokenId({ tokens: TOKENS, activeMapId: 'm1', currentId: id, dir: 1 }));
    expect(ids).not.toContain('x');
  });

  it('respects a visibility filter', () => {
    const isVisible = (t) => t.id !== 'b';
    expect(cycleTokenId({ tokens: TOKENS, activeMapId: 'm1', currentId: 'a', dir: 1, isVisible })).toBe('c');
  });

  it('returns null when the map has no tokens', () => {
    expect(cycleTokenId({ tokens: new Map(), activeMapId: 'm1', currentId: null, dir: 1 })).toBe(null);
  });
});

describe('announceTokenSelection', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="vtt-sr-announcements"></div>';
  });

  it('writes the selection to the polite live region', () => {
    announceTokenSelection({ id: 'a', name: 'Aria' });
    expect(document.getElementById('vtt-sr-announcements').textContent)
      .toBe('Aria selected. Press M to move, Escape to deselect.');
  });

  it('tolerates a missing region', () => {
    document.body.innerHTML = '';
    expect(() => announceTokenSelection({ id: 'a', name: 'Aria' })).not.toThrow();
  });
});

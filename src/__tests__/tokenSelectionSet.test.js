/**
 * A GM moves a group of tokens far more often than a single one, and
 * could not move more than one. Selection was a single id on the
 * renderer, mirrored into three signals; the marquee existed but only
 * ever drew fog, and `applyDamageToTokens` had been written and left
 * without a caller.
 *
 * The set keeps a primary, which is the token every existing reader
 * already asks about, so the sheet panels and the action bar keep
 * working with one token selected and gain the rest for free.
 */

import { describe, it, expect } from 'vitest';
import {
  emptySelection, selectOne, toggleInSelection, selectMany,
  primaryOf, isSelected, selectionSize,
} from '../map/token-selection.js';

describe('a selection of tokens', () => {
  it('starts empty, with no primary', () => {
    const sel = emptySelection();
    expect(selectionSize(sel)).toBe(0);
    expect(primaryOf(sel)).toBeNull();
  });

  it('selecting one replaces whatever was selected', () => {
    const sel = selectOne(selectMany(emptySelection(), ['a', 'b']), 'c');
    expect([...sel]).toEqual(['c']);
    expect(primaryOf(sel)).toBe('c');
  });

  it('selecting null clears the selection', () => {
    expect(selectionSize(selectOne(selectMany(emptySelection(), ['a', 'b']), null))).toBe(0);
  });

  it('toggling adds a token that was not selected', () => {
    const sel = toggleInSelection(selectOne(emptySelection(), 'a'), 'b');
    expect([...sel].sort()).toEqual(['a', 'b']);
  });

  it('toggling removes a token that was selected', () => {
    const sel = toggleInSelection(selectMany(emptySelection(), ['a', 'b']), 'a');
    expect([...sel]).toEqual(['b']);
  });

  it('keeps the most recently added token as the primary', () => {
    expect(primaryOf(toggleInSelection(selectOne(emptySelection(), 'a'), 'b'))).toBe('b');
  });

  it('picks a surviving token as primary when the primary is removed', () => {
    const sel = toggleInSelection(selectMany(emptySelection(), ['a', 'b']), 'b');
    expect(primaryOf(sel)).toBe('a');
  });

  it('answers whether a token is in the selection', () => {
    const sel = selectMany(emptySelection(), ['a', 'b']);
    expect(isSelected(sel, 'a')).toBe(true);
    expect(isSelected(sel, 'z')).toBe(false);
  });

  it('never returns the same set it was given, so signals notice', () => {
    const before = selectOne(emptySelection(), 'a');
    expect(toggleInSelection(before, 'b')).not.toBe(before);
  });

  it('ignores a duplicate rather than counting it twice', () => {
    expect(selectionSize(selectMany(emptySelection(), ['a', 'a', 'b']))).toBe(2);
  });
});

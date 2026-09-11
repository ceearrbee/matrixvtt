/**
 * The composer's star button toasted "Saving custom dice macros isn't
 * implemented yet" from an enabled control, and the Macros select next
 * to it never held anything. Both are now backed by the per-user store
 * that `user-storage.js` was written for - its own docblock names dice
 * macros as the leak it fixes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readDiceMacros, saveDiceMacro, deleteDiceMacro } from '../ui/dice-macros.js';

const USER = '@bo:hs';

describe('dice macros persist per user', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(readDiceMacros(USER)).toEqual([]);
  });

  it('saves a formula and reads it back', () => {
    saveDiceMacro(USER, 'd20+3');
    expect(readDiceMacros(USER)).toEqual(['d20+3']);
  });

  it('does not store the same formula twice', () => {
    saveDiceMacro(USER, 'd20+3');
    saveDiceMacro(USER, 'd20+3');
    expect(readDiceMacros(USER)).toEqual(['d20+3']);
  });

  it('ignores an empty formula', () => {
    saveDiceMacro(USER, '   ');
    expect(readDiceMacros(USER)).toEqual([]);
  });

  it('keeps one user out of another user\'s macros', () => {
    saveDiceMacro(USER, 'd20+3');
    expect(readDiceMacros('@ada:hs')).toEqual([]);
  });

  it('drops one', () => {
    saveDiceMacro(USER, 'd20+3');
    saveDiceMacro(USER, '2d6');
    deleteDiceMacro(USER, 'd20+3');
    expect(readDiceMacros(USER)).toEqual(['2d6']);
  });

  it('survives a corrupt stored value', () => {
    localStorage.setItem(`vtt:dice-macros::${USER}`, 'not json');
    expect(readDiceMacros(USER)).toEqual([]);
  });

  it('is a no-op before login rather than writing to a shared slot', () => {
    saveDiceMacro('', 'd20');
    expect(localStorage.length).toBe(0);
  });
});

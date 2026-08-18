/**
 * User-scoped localStorage tests.
 *
 * Two users sharing a browser must not leak macros or tour-completion
 * state. Legacy unscoped keys migrate into the current user's scope on
 * first read (one-shot).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readUserScoped,
  writeUserScoped,
  removeUserScoped,
} from '../utils/user-storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

const A = '@alice:s';
const B = '@bob:s';
const KEY = STORAGE_KEYS.DICE_MACROS;

describe('user-scoped storage', () => {
  beforeEach(() => { localStorage.clear(); });

  describe('isolation', () => {
    it('users do not share writes', () => {
      writeUserScoped(KEY, A, '[{"name":"a"}]');
      writeUserScoped(KEY, B, '[{"name":"b"}]');
      expect(readUserScoped(KEY, A)).toBe('[{"name":"a"}]');
      expect(readUserScoped(KEY, B)).toBe('[{"name":"b"}]');
    });

    it('returns null when nothing has been written for this user', () => {
      writeUserScoped(KEY, A, 'alice-data');
      expect(readUserScoped(KEY, B)).toBeNull();
    });

  });

  describe('legacy migration (one-shot)', () => {
    it('first user to read claims the legacy unscoped value', () => {
      localStorage.setItem(KEY, 'legacy-payload');
      expect(readUserScoped(KEY, A)).toBe('legacy-payload');
      // The legacy key is consumed: subsequent users do not inherit it.
      expect(readUserScoped(KEY, B)).toBeNull();
      // And the scoped key is populated for A so subsequent reads hit it.
      expect(localStorage.getItem(`${KEY}::${A}`)).toBe('legacy-payload');
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('migration is a no-op when a scoped value already exists', () => {
      localStorage.setItem(KEY, 'legacy');
      writeUserScoped(KEY, A, 'fresh');
      expect(readUserScoped(KEY, A)).toBe('fresh');
      // Legacy is left alone for the next reader to potentially claim,
      // since this user already had their own value.
      expect(localStorage.getItem(KEY)).toBe('legacy');
    });

    it('no userId: falls back to legacy unscoped read (no migration)', () => {
      localStorage.setItem(KEY, 'legacy');
      expect(readUserScoped(KEY, null)).toBe('legacy');
      // Did not move into a scoped slot since there is no user to scope to.
      expect(localStorage.getItem(KEY)).toBe('legacy');
    });
  });

  describe('tour completion shape', () => {
    const T = STORAGE_KEYS.TOUR_COMPLETED;

    it("alice's completion does not auto-complete bob", () => {
      writeUserScoped(T, A, '1');
      expect(readUserScoped(T, A)).toBe('1');
      expect(readUserScoped(T, B)).toBeNull();
    });
  });

  describe('removeUserScoped', () => {
    it('removes both the scoped and legacy unscoped values', () => {
      localStorage.setItem(KEY, 'legacy');
      writeUserScoped(KEY, A, 'x');
      removeUserScoped(KEY, A);
      expect(localStorage.getItem(`${KEY}::${A}`)).toBeNull();
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('without a userId removes only the unscoped value', () => {
      localStorage.setItem(KEY, 'legacy');
      writeUserScoped(KEY, A, 'x');
      removeUserScoped(KEY, null);
      expect(localStorage.getItem(KEY)).toBeNull();
      expect(localStorage.getItem(`${KEY}::${A}`)).toBe('x');
    });
  });
});

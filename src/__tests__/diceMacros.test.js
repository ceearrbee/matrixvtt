/**
 * Dice formula macros - saveDiceMacro / getDiceMacros / deleteDiceMacro
 *
 * Players can save named dice formulas (e.g. "2d6+3 fire") as macros.
 * Macros are stored in localStorage scoped to the user so two users
 * sharing a browser do not leak each other's macros.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { saveDiceMacro, getDiceMacros, deleteDiceMacro } from '../ui/dice-macros.js';

const U = '@me:s';

beforeEach(() => {
  localStorage.clear();
});

describe('dice macros', () => {
  it('saves a macro and retrieves it', () => {
    saveDiceMacro(U, 'fire bolt', '2d6+3');
    const macros = getDiceMacros(U);
    expect(macros).toHaveLength(1);
    expect(macros[0].name).toBe('fire bolt');
    expect(macros[0].formula).toBe('2d6+3');
  });

  it('returns empty array when no macros saved', () => {
    expect(getDiceMacros(U)).toEqual([]);
  });

  it('saves multiple macros', () => {
    saveDiceMacro(U, 'sneak attack', '3d6');
    saveDiceMacro(U, 'great sword', '2d6+5');
    expect(getDiceMacros(U)).toHaveLength(2);
  });

  it('deletes a macro by name', () => {
    saveDiceMacro(U, 'fire bolt', '2d6+3');
    saveDiceMacro(U, 'ice lance', '1d8+2');
    deleteDiceMacro(U, 'fire bolt');
    const macros = getDiceMacros(U);
    expect(macros).toHaveLength(1);
    expect(macros[0].name).toBe('ice lance');
  });

  it('overwriting a macro with same name updates the formula', () => {
    saveDiceMacro(U, 'attack', '1d20+3');
    saveDiceMacro(U, 'attack', '1d20+5');
    const macros = getDiceMacros(U);
    expect(macros).toHaveLength(1);
    expect(macros[0].formula).toBe('1d20+5');
  });
});

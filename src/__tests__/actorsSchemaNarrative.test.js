/**
 * Schema validation of the new narrative-primitive field shapes on
 * Character / NPC events. Pre-relax, the inbound syncer accepted
 * the new fields by accident (the validator only checks fields it
 * knows about). This test pins the contract so a future tightening
 * doesn't reject valid narrative data.
 */
import { describe, it, expect } from 'vitest';
import { validateCharacter } from '../utils/schemas/actors.js';

function baseChar(extra = {}) {
  return { id: 'c1', name: 'Aria', type: 'pc', ...extra };
}

describe('validateCharacter - narrative primitive fields', () => {
  it('accepts a string[] aspects field', () => {
    expect(() => validateCharacter(baseChar({ aspects: ['Trouble: hot-headed', 'High concept'] }))).not.toThrow();
  });

  it('accepts a multi-track stress object (Record<string, boolean[]>)', () => {
    expect(() => validateCharacter(baseChar({
      stress: { Physical: [false, false, false], Mental: [true, false, false] },
    }))).not.toThrow();
  });

  it('accepts the legacy array-shape stress field too (back-compat)', () => {
    expect(() => validateCharacter(baseChar({ stress: [false, true, false] }))).not.toThrow();
  });

  it('accepts a consequences slot map (Record<string, string>)', () => {
    expect(() => validateCharacter(baseChar({
      consequences: { mild: 'Sprained ankle', moderate: '', severe: '' },
    }))).not.toThrow();
  });

  it('accepts numeric fate_points / fate_refresh / fate_max', () => {
    expect(() => validateCharacter(baseChar({
      fate_points: 3, fate_refresh: 3, fate_max: 5,
    }))).not.toThrow();
  });

  it('rejects non-numeric fate_points with a clear message', () => {
    expect(() => validateCharacter(baseChar({ fate_points: 'three' }))).toThrow(/fate_points/i);
  });

  it('rejects non-string aspects entries', () => {
    expect(() => validateCharacter(baseChar({ aspects: ['ok', 42] }))).toThrow(/aspect/i);
  });

  it('rejects malformed stress (string instead of array/object)', () => {
    expect(() => validateCharacter(baseChar({ stress: 'broken' }))).toThrow(/stress/i);
  });

  it('rejects malformed consequences (array instead of object)', () => {
    expect(() => validateCharacter(baseChar({ consequences: ['mild'] }))).toThrow(/consequences/i);
  });

  it('does not reject characters that omit any of the narrative fields', () => {
    expect(() => validateCharacter(baseChar())).not.toThrow();
  });
});

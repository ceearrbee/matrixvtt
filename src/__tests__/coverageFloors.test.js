/**
 * The floors carry the comment "Ratchet floors just under current
 * coverage; raise as coverage grows." Coverage grew and nobody
 * ratcheted, leaving nearly six points of slack: enough to delete a
 * meaningful amount of tested behaviour with the gate still quiet.
 * Pinning them here means lowering a floor is a visible edit rather
 * than a quiet one.
 */
import { describe, it, expect } from 'vitest';
import config from '../../vitest.config.js';

const floors = config.test.coverage.thresholds;

describe('coverage floors', () => {
  it('sits just under the coverage the suite actually reaches', () => {
    expect(floors).toEqual({
      statements: 76,
      branches: 68,
      functions: 72,
      lines: 79,
    });
  });
});

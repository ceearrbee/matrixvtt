/**
 * Pure first-render decision. The setup wizard opens on its own only
 * for a room the user just created, and never over campaign data that
 * is already there. Every other room opens straight to its chat.
 */
import { describe, it, expect } from 'vitest';
import { decideFirstRender } from '../ui/first-render-decision.js';

const base = { forceWizard: false, residual: 0, snapshotState: 'absent' };

describe('decideFirstRender', () => {
  it('a room with no campaign opens without the wizard', () => {
    expect(decideFirstRender({ ...base })).toBe(false);
    expect(decideFirstRender({ ...base, snapshotState: 'unknown' })).toBe(false);
  });

  it('a room the user just created opens the wizard', () => {
    expect(decideFirstRender({ ...base, forceWizard: true })).toBe(true);
    expect(decideFirstRender({ ...base, forceWizard: true, snapshotState: 'unknown' })).toBe(true);
  });

  it('the wizard never opens over existing campaign data', () => {
    expect(decideFirstRender({ ...base, forceWizard: true, residual: 3 })).toBe(false);
    expect(decideFirstRender({ ...base, forceWizard: true, snapshotState: 'present' })).toBe(false);
  });
});

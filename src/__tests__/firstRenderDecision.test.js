/**
 * Pure first-render decision. The wizard-vs-welcome choice was racy:
 * startVTT stamped room-visited immediately after initVTT resolved,
 * which could land before render-policy's rAF read it and suppress the
 * wizard for the GM who just created the room. The decision is now a
 * pure function where an explicit forceWizard (create-room intent)
 * beats the visited stamp.
 */
import { describe, it, expect } from 'vitest';
import { decideFirstRender } from '../ui/first-render-decision.js';

const base = {
  alreadyVisited: false,
  noMap: true,
  forceWizard: false,
  residual: 0,
  snapshotState: 'unknown',
};

describe('decideFirstRender', () => {
  it('fresh empty room shows the wizard', () => {
    expect(decideFirstRender({ ...base }).showWizard).toBe(true);
  });

  it('forceWizard beats the visited stamp on an empty room', () => {
    const res = decideFirstRender({ ...base, alreadyVisited: true, forceWizard: true });
    expect(res.showWizard).toBe(true);
  });

  it('forceWizard still defers to residual entities and a server snapshot', () => {
    expect(decideFirstRender({ ...base, forceWizard: true, residual: 3 }).showWizard).toBe(false);
    expect(decideFirstRender({ ...base, forceWizard: true, snapshotState: 'present' }).showWizard).toBe(false);
  });

  it('a visited room never re-prompts on normal entry', () => {
    expect(decideFirstRender({ ...base, alreadyVisited: true }).showWizard).toBe(false);
  });

  it('a stale stamp on a confirmed-empty room is invalidated', () => {
    const res = decideFirstRender({ ...base, alreadyVisited: true, snapshotState: 'absent' });
    expect(res.staleStamp).toBe(true);
    expect(res.showWizard).toBe(true);
  });

  it('an unknown probe never invalidates the stamp', () => {
    const res = decideFirstRender({ ...base, alreadyVisited: true, snapshotState: 'unknown' });
    expect(res.staleStamp).toBe(false);
    expect(res.showWizard).toBe(false);
  });

  it('residual entities suppress the wizard even with no map', () => {
    expect(decideFirstRender({ ...base, residual: 2 }).showWizard).toBe(false);
  });
});

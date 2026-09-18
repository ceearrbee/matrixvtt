/**
 * A checklist chip you can click has to be a chip that can succeed.
 *
 * On a blank campaign the GM's four chips all looked equally live, and
 * two of them could only fail: "Add a token" armed placement mode over
 * a canvas that does not exist, so the next click went nowhere and the
 * mode stayed armed invisibly; "Start combat" fired a toast telling the
 * GM to place tokens first. A first-run aid that scolds you for
 * following it is worse than no aid.
 *
 * All four still show, because the point of the row is to read the
 * shape of the work. A step that is waiting on an earlier one now says
 * what it is waiting for, and running it runs the thing it is waiting
 * for - so a click always moves the table forward.
 */
import { describe, it, expect } from 'vitest';
import { nextStepsFor, NEXT_STEP_KEYS } from '../ui/next-steps.js';

function room(overrides = {}) {
  return {
    isGM: true,
    memberCount: 1,
    maps: new Map(),
    tokens: new Map(),
    characters: new Map(),
    initiative: { active: false, order: [] },
    myUserId: '@gm:hs',
    ...overrides,
  };
}

const step = (steps, key) => steps.find((s) => s.key === key);
const mapWithArt = () => new Map([['m1', { id: 'm1', image_url: 'mxc://x/y' }]]);

describe('next steps wait for what they need', () => {
  it('still offers the full shape of the work on a blank campaign', () => {
    expect(nextStepsFor(room())).toHaveLength(4);
  });

  it('blocks the token step on a map', () => {
    expect(step(nextStepsFor(room()), NEXT_STEP_KEYS.TOKEN).blockedBy)
      .toBe(NEXT_STEP_KEYS.MAP);
  });

  it('blocks the combat step on a token', () => {
    expect(step(nextStepsFor(room()), NEXT_STEP_KEYS.COMBAT).blockedBy)
      .toBe(NEXT_STEP_KEYS.TOKEN);
  });

  it('says what a blocked step is waiting for', () => {
    const tokenStep = step(nextStepsFor(room()), NEXT_STEP_KEYS.TOKEN);
    expect(tokenStep.hint).toMatch(/map/i);
    expect(tokenStep.hint).not.toBe('Put a character or monster on the map.');
  });

  it('unblocks the token step the moment a map lands', () => {
    const steps = nextStepsFor(room({ maps: mapWithArt() }));
    expect(step(steps, NEXT_STEP_KEYS.TOKEN).blockedBy).toBe(null);
    expect(step(steps, NEXT_STEP_KEYS.TOKEN).hint).toMatch(/character or monster/i);
  });

  it('unblocks the combat step the moment a token lands', () => {
    const steps = nextStepsFor(room({
      maps: mapWithArt(), tokens: new Map([['t1', { id: 't1' }]]),
    }));
    expect(step(steps, NEXT_STEP_KEYS.COMBAT).blockedBy).toBe(null);
  });

  it('never blocks the two steps that need nothing first', () => {
    const steps = nextStepsFor(room());
    expect(step(steps, NEXT_STEP_KEYS.MAP).blockedBy).toBe(null);
    expect(step(steps, NEXT_STEP_KEYS.INVITE).blockedBy).toBe(null);
  });

  it('leaves a finished step unblocked even if its prerequisite went away', () => {
    const steps = nextStepsFor(room({ tokens: new Map([['t1', { id: 't1' }]]) }));
    const tokenStep = step(steps, NEXT_STEP_KEYS.TOKEN);
    expect(tokenStep.done).toBe(true);
    expect(tokenStep.blockedBy).toBe(null);
  });

  it('asks nothing of a player before they have a sheet', () => {
    const [only] = nextStepsFor(room({ isGM: false, myUserId: '@bo:hs' }));
    expect(only.blockedBy).toBe(null);
  });
});

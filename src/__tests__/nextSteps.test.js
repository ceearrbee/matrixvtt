/**
 * The next-steps checklist: three to five items that tick themselves
 * from real room state and disappear when the table is set up. It
 * replaces the wizard's transient "you are the GM" toast, which was the
 * only confirmation a GM ever got, and carries the invite link the
 * 12-step tour never mentioned.
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

const keysOf = (steps) => steps.map((s) => s.key);

describe('nextStepsFor - GM', () => {
  it('offers between three and five steps, the researched span', () => {
    const steps = nextStepsFor(room());
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeLessThanOrEqual(5);
  });

  it('leads with the map and the invite, the two a table cannot start without', () => {
    expect(keysOf(nextStepsFor(room())).slice(0, 2))
      .toEqual([NEXT_STEP_KEYS.MAP, NEXT_STEP_KEYS.INVITE]);
  });

  it('starts with nothing done on a blank campaign', () => {
    expect(nextStepsFor(room()).every((s) => s.done === false)).toBe(true);
  });

  it('ticks the map step once a map carries an image', () => {
    const maps = new Map([['m1', { id: 'm1', name: 'Empty Map', image_url: null }]]);
    expect(nextStepsFor(room({ maps })).find((s) => s.key === NEXT_STEP_KEYS.MAP).done).toBe(false);
    maps.set('m2', { id: 'm2', name: 'Crypt', image_url: 'mxc://x/y' });
    expect(nextStepsFor(room({ maps })).find((s) => s.key === NEXT_STEP_KEYS.MAP).done).toBe(true);
  });

  it('ticks the invite step once somebody else is in the room', () => {
    expect(nextStepsFor(room({ memberCount: 2 })).find((s) => s.key === NEXT_STEP_KEYS.INVITE).done).toBe(true);
  });

  it('ticks the token step once a token exists', () => {
    const tokens = new Map([['t1', { id: 't1' }]]);
    expect(nextStepsFor(room({ tokens })).find((s) => s.key === NEXT_STEP_KEYS.TOKEN).done).toBe(true);
  });

  it('ticks the combat step once an order exists', () => {
    const initiative = { active: true, order: [{ name: 'Aria' }] };
    expect(nextStepsFor(room({ initiative })).find((s) => s.key === NEXT_STEP_KEYS.COMBAT).done).toBe(true);
  });
});

describe('nextStepsFor - room with no campaign', () => {
  it('offers a GM campaign setup and nothing else', () => {
    expect(keysOf(nextStepsFor(room({ hasCampaign: false })))).toEqual([NEXT_STEP_KEYS.SETUP]);
  });

  it('offers a player nothing that would write to the room', () => {
    expect(nextStepsFor(room({ isGM: false, hasCampaign: false }))).toEqual([]);
  });
});

describe('nextStepsFor - player', () => {
  it('asks a player for one thing only', () => {
    const steps = nextStepsFor(room({ isGM: false, myUserId: '@bo:hs' }));
    expect(keysOf(steps)).toEqual([NEXT_STEP_KEYS.CHARACTER]);
  });

  // The chip said "Claim your character" and ran the create wizard.
  // The label, the hint and the action now agree with each other.
  it('offers to claim when the GM has left an unclaimed sheet', () => {
    const characters = new Map([['c1', { id: 'c1', name: 'Aria' }]]);
    const [step] = nextStepsFor(room({ isGM: false, myUserId: '@bo:hs', characters }));
    expect(step.label).toMatch(/claim/i);
    expect(step.action).toBe('claim');
  });

  it('offers to create when no sheet is waiting', () => {
    const [step] = nextStepsFor(room({ isGM: false, myUserId: '@bo:hs' }));
    expect(step.label).not.toMatch(/claim/i);
    expect(step.action).toBe('create');
  });

  it('does not offer to claim a sheet somebody else already owns', () => {
    const characters = new Map([['c1', { id: 'c1', player_user_id: '@ann:hs' }]]);
    const [step] = nextStepsFor(room({ isGM: false, myUserId: '@bo:hs', characters }));
    expect(step.action).toBe('create');
  });

  it('ticks once the player owns or has claimed a character', () => {
    const characters = new Map([['c1', { id: 'c1', claimed_by_user_id: '@bo:hs' }]]);
    const steps = nextStepsFor(room({ isGM: false, myUserId: '@bo:hs', characters }));
    expect(steps[0].done).toBe(true);
  });

  it('does not tick for somebody else\'s character', () => {
    const characters = new Map([['c1', { id: 'c1', player_user_id: '@ann:hs' }]]);
    const steps = nextStepsFor(room({ isGM: false, myUserId: '@bo:hs', characters }));
    expect(steps[0].done).toBe(false);
  });
});

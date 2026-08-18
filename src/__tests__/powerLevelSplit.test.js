import { describe, it, expect } from 'vitest';
import { computeNewPowerLevels } from '../widget/capabilities.js';
import { YJS_EVENT_TYPES, EVENT_TYPES } from '../utils/constants.js';

const base = {
  users: { '@creator:hs': 100 },
  users_default: 0,
  events: {},
  state_default: 50,
};

describe('computeNewPowerLevels - Yjs event split', () => {
  it('gates the authoritative snapshot at GM level even when state_default is permissive', () => {
    const next = computeNewPowerLevels({ ...base, state_default: 0 }, ['@gm:hs']);
    expect(next.events[YJS_EVENT_TYPES.SNAPSHOT]).toBe(50);
  });

  it('keeps yjs updates and sync vectors writable by players', () => {
    const next = computeNewPowerLevels(base, ['@gm:hs']);
    expect(next.events[YJS_EVENT_TYPES.UPDATE]).toBe(0);
    expect(next.events[YJS_EVENT_TYPES.SYNC_VECTOR]).toBe(0);
  });

  it('preserves existing users and promotes GMs to 50', () => {
    const next = computeNewPowerLevels(base, ['@gm:hs']);
    expect(next.users['@creator:hs']).toBe(100);
    expect(next.users['@gm:hs']).toBe(50);
    expect(next.events[EVENT_TYPES.SETTINGS]).toBe(50);
  });
});

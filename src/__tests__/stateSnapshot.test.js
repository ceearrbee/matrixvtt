/**
 * Periodic localStorage snapshots - local-only safety net for the
 * campaign state. Snapshot scope: per-(userId, roomId), one rolling
 * slot. Round-trip via exportCampaign / importCampaign.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveSnapshot, loadSnapshot, restoreSnapshot,
  startSnapshotInterval, __clearSnapshotCacheForTests,
} from '../utils/state-snapshot.js';

function mockMap(data = []) {
  const m = new Map(data);
  m.replace = (next) => { m.clear(); for (const [k, v] of next) m.set(k, v); };
  return m;
}

function makeState(overrides = {}) {
  const state = {
    settings: { name: 'A', system: 'generic' },
    maps: mockMap(),
    tokens: mockMap(),
    characters: mockMap(),
    npcs: mockMap(),
    items: mockMap(),
    spells: mockMap(),
    handouts: mockMap(),
    tables: mockMap(),
    pins: mockMap(),
    walls: mockMap(),
    templates: mockMap(),
    fog: { mode: 'hidden', revealed: [] },
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    drawings: [],
    activeMapId: null,
    ...overrides,
  };
  return state;
}

beforeEach(async () => {
  localStorage.clear();
  __clearSnapshotCacheForTests();
});

describe('saveSnapshot / loadSnapshot', () => {
  it('round-trips a campaign through IndexedDB', async () => {
    const state = makeState({
      tokens: new Map([['t1', { id: 't1', name: 'Goblin', col: 0, row: 0 }]]),
    });
    const result = saveSnapshot(state, '@me:hs', '!r:hs');
    expect(result?.saved).toBe(true);
    expect(typeof result?.ts).toBe('number');

    const loaded = await loadSnapshot('@me:hs', '!r:hs');
    expect(loaded?.campaign?.tokens?.[0]?.name).toBe('Goblin');
  });

  it('overwrites the previous snapshot (single-slot)', async () => {
    saveSnapshot(makeState({ settings: { name: 'first' } }), '@me:hs', '!r:hs');
    saveSnapshot(makeState({ settings: { name: 'second' } }), '@me:hs', '!r:hs');
    expect((await loadSnapshot('@me:hs', '!r:hs')).campaign.settings.name).toBe('second');
  });

  it('isolates by user + room', async () => {
    saveSnapshot(makeState({ settings: { name: 'me-r1' } }), '@me:hs', '!r1:hs');
    saveSnapshot(makeState({ settings: { name: 'me-r2' } }), '@me:hs', '!r2:hs');
    saveSnapshot(makeState({ settings: { name: 'gm-r1' } }), '@gm:hs', '!r1:hs');
    expect((await loadSnapshot('@me:hs', '!r1:hs')).campaign.settings.name).toBe('me-r1');
    expect((await loadSnapshot('@me:hs', '!r2:hs')).campaign.settings.name).toBe('me-r2');
    expect((await loadSnapshot('@gm:hs', '!r1:hs')).campaign.settings.name).toBe('gm-r1');
  });

  it('returns null when no snapshot exists', async () => {
    expect(await loadSnapshot('@me:hs', '!r:hs')).toBeNull();
  });

  it('handles missing userId / roomId gracefully', async () => {
    expect(saveSnapshot(makeState(), null, '!r:hs')).toBeNull();
    expect(await loadSnapshot(null, '!r:hs')).toBeNull();
  });
});

describe('restoreSnapshot', () => {
  it('rehydrates StateManager collections from a saved snapshot', async () => {
    const original = makeState({
      tokens: new Map([['t1', { id: 't1', name: 'Goblin' }]]),
      characters: new Map([['c1', { id: 'c1', name: 'Aragorn' }]]),
    });
    saveSnapshot(original, '@me:hs', '!r:hs');
    const snap = await loadSnapshot('@me:hs', '!r:hs');

    const target = makeState();
    expect(target.tokens.size).toBe(0);
    restoreSnapshot(target, snap);
    expect(target.tokens.get('t1')?.name).toBe('Goblin');
    expect(target.characters.get('c1')?.name).toBe('Aragorn');
  });

  it('returns false on invalid snapshot', () => {
    expect(restoreSnapshot(makeState(), null)).toBe(false);
    expect(restoreSnapshot(makeState(), {})).toBe(false);
  });
});

describe('startSnapshotInterval', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('saves on every tick', async () => {
    const state = makeState({ tokens: new Map([['t1', { id: 't1', name: 'X' }]]) });
    const stop = startSnapshotInterval(state, '@me:hs', '!r:hs', 1000);
    expect(await loadSnapshot('@me:hs', '!r:hs')).toBeNull();
    vi.advanceTimersByTime(1000);
    await vi.runOnlyPendingTimersAsync();
    expect(await loadSnapshot('@me:hs', '!r:hs')).not.toBeNull();
    stop();
  });

  it('returned stop function clears the timer', async () => {
    const state = makeState();
    const stop = startSnapshotInterval(state, '@me:hs', '!r:hs', 1000);
    stop();
    vi.advanceTimersByTime(5000);
    expect(await loadSnapshot('@me:hs', '!r:hs')).toBeNull();
  });
});


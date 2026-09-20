/**
 * Room-scoped asset library: what has been uploaded into this room, so
 * an image uploaded once is reusable instead of re-uploaded.
 *
 * Deliberately NOT GM-gated. Players upload token portraits, and the
 * whole reason this lives in Yjs rather than a room state event is that
 * state writes are power-level gated and would silently fail for them.
 */
import { describe, it, expect, vi } from 'vitest';
import { recordAsset, removeAsset } from '../writers/asset-writers.js';
import { ASSET_KINDS, ASSET_LIBRARY_MAX_ENTRIES } from '../../utils/constants.js';

function makeYMap() {
  const inner = new Map();
  return {
    set: vi.fn((k, v) => inner.set(k, v)),
    delete: vi.fn((k) => inner.delete(k)),
    has: (k) => inner.has(k),
    get: (k) => inner.get(k),
    doc: { transact: (fn) => fn() },
    _inner: inner,
  };
}

function makeSm({ isGm = false, userId = '@player:m' } = {}) {
  const assetsMap = makeYMap();
  return {
    assets: assetsMap._inner,
    widgetManager: { userId },
    powerLevels: { users: isGm ? { '@player:m': 50 } : {} },
    yjs: { assetsMap },
  };
}

const FILE = { mxc: 'mxc://hs/abc', name: 'tavern.png', width: 2048, height: 1536, kind: ASSET_KINDS.MAP };

describe('recordAsset', () => {
  // The user id lives on the transport, not the StateManager: reading
  // sm.userId silently recorded every asset as anonymous.
  it('records the whole reference, with who added it and when', async () => {
    const sm = makeSm();
    const id = await recordAsset(sm, FILE);
    const stored = sm.yjs.assetsMap.get(id);
    expect(stored).toMatchObject({
      id, mxc: 'mxc://hs/abc', name: 'tavern.png', width: 2048, height: 1536,
      kind: ASSET_KINDS.MAP, uploaded_by: '@player:m',
    });
    expect(stored.ts).toBeTypeOf('number');
  });

  it('allocates positional ids the same way every other collection does', async () => {
    const sm = makeSm();
    expect(await recordAsset(sm, FILE)).toBe('ast-1');
    expect(await recordAsset(sm, { ...FILE, mxc: 'mxc://hs/two' })).toBe('ast-2');
  });

  it('lets a player record without a power level', async () => {
    const sm = makeSm({ isGm: false });
    await expect(recordAsset(sm, FILE)).resolves.toBeTruthy();
  });

  it('returns the existing id for an mxc already recorded, rather than a duplicate row', async () => {
    const sm = makeSm();
    const first = await recordAsset(sm, FILE);
    const second = await recordAsset(sm, { ...FILE, name: 'same-image-other-name.png' });
    expect(second).toBe(first);
    expect(sm.assets.size).toBe(1);
  });

  it('refuses anything that is not an mxc reference', async () => {
    const sm = makeSm();
    await expect(recordAsset(sm, { ...FILE, mxc: 'https://cdn/x.png' })).resolves.toBeNull();
    await expect(recordAsset(sm, { ...FILE, mxc: '' })).resolves.toBeNull();
    await expect(recordAsset(sm, null)).resolves.toBeNull();
    expect(sm.assets.size).toBe(0);
  });

  it('defaults an unknown kind rather than storing junk', async () => {
    const sm = makeSm();
    const id = await recordAsset(sm, { ...FILE, kind: 'spaceship' });
    expect(sm.yjs.assetsMap.get(id).kind).toBe(ASSET_KINDS.OTHER);
  });

  // Yjs history is append-only, so an unbounded list grows the document
  // for the life of the campaign.
  it('evicts the oldest entry once the library is full', async () => {
    const sm = makeSm();
    for (let i = 0; i < ASSET_LIBRARY_MAX_ENTRIES; i += 1) {
      await recordAsset(sm, { ...FILE, mxc: `mxc://hs/${i}`, ts: 1000 + i });
    }
    expect(sm.assets.size).toBe(ASSET_LIBRARY_MAX_ENTRIES);
    const oldestId = [...sm.assets.values()].sort((a, b) => a.ts - b.ts)[0].id;

    await recordAsset(sm, { ...FILE, mxc: 'mxc://hs/newest' });
    expect(sm.assets.size).toBe(ASSET_LIBRARY_MAX_ENTRIES);
    expect(sm.assets.has(oldestId)).toBe(false);
  });
});

describe('removeAsset', () => {
  it('removes a recorded asset', async () => {
    const sm = makeSm();
    const id = await recordAsset(sm, FILE);
    await removeAsset(sm, id);
    expect(sm.assets.has(id)).toBe(false);
  });

  it('is a no-op for an id that was never recorded', async () => {
    const sm = makeSm();
    await removeAsset(sm, 'ast-99');
    expect(sm.yjs.assetsMap.delete).not.toHaveBeenCalled();
  });
});

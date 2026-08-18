/**
 * Lock-in: the ui controller's public surface matches
 * `src/ui/_public-surface.js` exactly. Fix.md finding 10 calls for "a
 * small stable public surface instead of continuing to accrete
 * helpers"; this test fails on both unauthorised additions ("you
 * added a new `ui.foo` - either add it to the surface manifest or
 * route through an existing method") and stale entries ("the manifest
 * lists `ui.foo` but it's no longer attached - remove it").
 */
import { describe, it, expect, vi } from 'vitest';
import { createMinimalUI } from '../ui/ui-methods.js';
import { PUBLIC_SURFACE, INTERNAL_SURFACE, allKnownKeys } from '../ui/_public-surface.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class { constructor() {} render() {} destroy() {} },
}));

function makeUi() {
  const state = {
    isGM: () => false,
    characters: new Map(), npcs: new Map(), tokens: new Map(),
    items: new Map(), spells: new Map(), handouts: new Map(), tables: new Map(),
    settings: { gm_user_ids: [] },
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    roomMembers: [],
    sendStateEvent: vi.fn().mockResolvedValue(undefined),
  };
  const widgetManager = { userId: '@me:s', isStandalone: true };
  return createMinimalUI(state, widgetManager, null);
}

describe('ui controller - stable public surface', () => {
  const ui = makeUi();
  const actual = new Set(Object.keys(ui));
  const known = allKnownKeys();

  const listedPublic = new Set(Object.values(PUBLIC_SURFACE).flat());
  const listedInternal = new Set(INTERNAL_SURFACE);

  it('public surface has no duplicates across categories', () => {
    const counts = new Map();
    for (const [category, keys] of Object.entries(PUBLIC_SURFACE)) {
      for (const key of keys) {
        counts.set(key, [...(counts.get(key) ?? []), category]);
      }
    }
    const dups = [...counts.entries()].filter(([, cats]) => cats.length > 1);
    expect(dups).toEqual([]);
  });

  it('public and internal surfaces are disjoint', () => {
    const overlap = [...listedPublic].filter((k) => listedInternal.has(k));
    expect(overlap).toEqual([]);
  });

  it('no unauthorised keys on the constructed ui', () => {
    const unauthorised = [...actual].filter((k) => !known.has(k));
    if (unauthorised.length) {
      throw new Error(
        `ui grew new keys that are not in _public-surface.js. Either:\n` +
        `  • add each to PUBLIC_SURFACE (with a category) or INTERNAL_SURFACE (if underscore-prefixed), OR\n` +
        `  • route through an existing ui method instead of adding a new one.\n` +
        `New keys:\n  ${unauthorised.join('\n  ')}`
      );
    }
    expect(unauthorised).toEqual([]);
  });

  it('no stale entries - every listed public key is actually attached', () => {
    const missing = [...listedPublic].filter((k) => !actual.has(k));
    if (missing.length) {
      throw new Error(
        `PUBLIC_SURFACE lists keys the constructed ui does not attach - remove them:\n  ${missing.join('\n  ')}`
      );
    }
    expect(missing).toEqual([]);
  });
});

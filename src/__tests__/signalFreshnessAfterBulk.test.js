/**
 * signalFreshnessAfterBulk.test.js - lock-in for bulk-reset paths.
 *
 * initBlankCampaign / `_clearAllState` both mutate multiple signals at
 * once. Each mutation publishes immediately (ReactiveMap / signal-
 * accessor writes), so signals always match the Maps at the end of
 * the bulk op. If a future bulk path ever bypasses the ReactiveMap /
 * accessor API, this test fails.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../state/StateManager.js';
import {
  tokensSignal, charactersSignal, mapsSignal, activeMapIdSignal,
} from '../state/signals.js';

function makeSm() {
  // Subscription manager that actually wires the bridge. The
  // production SubscriptionManager does this via its signal-or-
  // observable detection; the StateManager constructor now wires
  // _wireYjsBridges, so the mock has to honour the subscribe call
  // for Y.Map → ReactiveMap mirroring to fire.
  const subs = new Map();
  const subscriptionManager = {
    subscribe(name, source, fn) {
      subs.get(name)?.();
      const unsub = source.subscribe?.(fn) ?? (() => {});
      subs.set(name, unsub);
      return { unsubscribe: unsub };
    },
    destroy() { for (const u of subs.values()) u(); subs.clear(); },
  };
  return new StateManager(
    { isStandalone: true, getApi: () => null, userId: '@u:s' },
    subscriptionManager,
  );
}

describe('signals stay fresh after bulk StateManager resets', () => {
  let sm;
  beforeEach(() => { sm = makeSm(); });

  it('initBlankCampaign leaves tokensSignal empty, mapsSignal size 1, activeMapId set', () => {
    sm.tokens.set('t1', { name: 'Stale' });
    expect(tokensSignal.value.has('t1')).toBe(true);

    sm.initBlankCampaign('Test Campaign', 'dnd5e');

    expect(tokensSignal.value.has('t1')).toBe(false);
    expect(mapsSignal.value.size).toBe(1);
    expect(activeMapIdSignal.value).not.toBeNull();
  });

  it('_clearAllState empties every collection signal', () => {
    sm.characters.set('c1', { name: 'Ghost' });
    expect(charactersSignal.value.has('c1')).toBe(true);

    sm._clearAllState();

    expect(charactersSignal.value.has('c1')).toBe(false);
  });
});

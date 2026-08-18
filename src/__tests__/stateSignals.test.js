/**
 * stateSignals.test.js - locks in that StateManager mutations publish
 * to the canonical signals. ReactiveMap + singleton-accessor writes
 * publish on the mutation itself; no explicit notifyUpdate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../state/StateManager.js';
import {
  tokensSignal, charactersSignal, fogSignal, initiativeSignal,
  settingsSignal, activeMapIdSignal, roomMembersSignal,
} from '../state/signals.js';

function makeSm() {
  return new StateManager(
    { isStandalone: true, getApi: () => null },
    { subscribe: () => {}, destroy: () => {} },
  );
}

describe('StateManager mutations publish to signals', () => {
  let sm;
  beforeEach(() => { sm = makeSm(); });

  it('tokens.set republishes tokensSignal with a fresh reference', () => {
    const before = tokensSignal.value;
    sm.tokens.set('t1', { name: 'Goblin' });
    expect(tokensSignal.value).not.toBe(before);
    expect(tokensSignal.value.get('t1')).toEqual({ name: 'Goblin' });
  });

  it('characters.set republishes charactersSignal', () => {
    sm.characters.set('c1', { name: 'Arwen' });
    expect(charactersSignal.value.get('c1')).toEqual({ name: 'Arwen' });
  });

  it('sm.fog = … publishes fogSignal with the new per-map entry', () => {
    sm.activeMapId = 'map-test';
    const before = fogSignal.value;
    sm.fog = { mode: 'revealed', revealed: ['1,1'] };
    expect(fogSignal.value).not.toBe(before);
    expect(fogSignal.value.get('map-test').mode).toBe('revealed');
  });

  it('sm.initiative = … publishes initiativeSignal', () => {
    sm.initiative = { active: true, round: 3, current_index: 1, order: ['a', 'b'] };
    expect(initiativeSignal.value.round).toBe(3);
    expect(initiativeSignal.value.order).toEqual(['a', 'b']);
  });

  it('sm.settings = / sm.activeMapId = publish independently', () => {
    sm.settings = { name: 'Game', system: 'dnd5e', grid_px: 50, gm_user_ids: [] };
    sm.activeMapId = 'map-42';
    expect(settingsSignal.value.name).toBe('Game');
    expect(activeMapIdSignal.value).toBe('map-42');
  });

  it('sm.roomMembers = … publishes roomMembersSignal', () => {
    sm.roomMembers = [{ userId: '@a:s' }, { userId: '@b:s' }];
    expect(roomMembersSignal.value).toHaveLength(2);
  });

  it('mutating multiple collections publishes each one', () => {
    sm.activeMapId = 'map-test';
    sm.tokens.set('t', { name: 'T' });
    sm.characters.set('c', { name: 'C' });
    sm.fog = { mode: 'revealed', revealed: [] };
    sm.initiative = { active: true, round: 1, current_index: 0, order: [] };
    expect(tokensSignal.value.get('t')).toEqual({ name: 'T' });
    expect(charactersSignal.value.get('c')).toEqual({ name: 'C' });
    expect(fogSignal.value.get('map-test').mode).toBe('revealed');
    expect(initiativeSignal.value.active).toBe(true);
  });
});

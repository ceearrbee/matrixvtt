/**
 * Damage audit trail (§27 DATA-MODEL-SPEC).
 *
 * Covers the StateManager-level `damageLog` + `recordDamage`, cap enforcement,
 * and the ChatIntegrator timeline path that routes `com.vtt.damage_event`
 * into the log.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordDamage } from '../state/writer.js';
import { ChatIntegrator } from '../chat-integrator.js';
import { EVENT_TYPES } from '../utils/constants.js';

function makeSm() {
  return {
    damageLog: [],
    recordDamage(entry) { return recordDamage(this, entry); },
  };
}

describe('recordDamage', () => {
  it('pushes a normalized entry', () => {
    const sm = makeSm();
    recordDamage(sm, {
      actor: '@gm:x',
      target_id: 'tok-1',
      target_name: 'Goblin',
      delta: -7,
      kind: 'damage',
      source: 'Longsword',
    });
    expect(sm.damageLog).toHaveLength(1);
    expect(sm.damageLog[0]).toMatchObject({
      actor: '@gm:x',
      target_id: 'tok-1',
      target_name: 'Goblin',
      delta: -7,
      kind: 'damage',
      source: 'Longsword',
    });
    expect(typeof sm.damageLog[0].ts).toBe('number');
  });

  it('fills defaults for missing fields', () => {
    const sm = makeSm();
    recordDamage(sm, { delta: 5, kind: 'heal' });
    expect(sm.damageLog[0].actor).toBeNull();
    expect(sm.damageLog[0].source).toBeNull();
  });

  it('ignores non-object entries', () => {
    const sm = makeSm();
    recordDamage(sm, null);
    recordDamage(sm, 'oops');
    expect(sm.damageLog).toHaveLength(0);
  });

  it('caps the log at 100 entries (FIFO)', () => {
    const sm = makeSm();
    for (let i = 0; i < 120; i++) recordDamage(sm, { delta: -1, kind: 'damage', source: `s${i}` });
    expect(sm.damageLog).toHaveLength(100);
    expect(sm.damageLog[0].source).toBe('s20');
    expect(sm.damageLog[99].source).toBe('s119');
  });
});

describe('ChatIntegrator - DAMAGE_EVENT routing', () => {
  let sm, chat;

  beforeEach(() => {
    sm = makeSm();
    const wm = { userId: '@me:x', sendRoomEvent: vi.fn() };
    chat = new ChatIntegrator(wm, sm, { roll: vi.fn() });
  });

  it('appends remote damage events to the audit log', async () => {
    await chat.handleTimelineEvent({
      type: EVENT_TYPES.DAMAGE_EVENT,
      sender: '@peer:x',
      content: {
        ts: 1700000000000, actor: '@peer:x',
        target_id: 't-2', target_name: 'Orc',
        delta: -10, kind: 'damage', source: 'Fireball',
      },
    });
    expect(sm.damageLog).toHaveLength(1);
    expect(sm.damageLog[0].actor).toBe('@peer:x');
    expect(sm.damageLog[0].source).toBe('Fireball');
  });

  it('skips own echo to avoid double-counting local applications', async () => {
    await chat.handleTimelineEvent({
      type: EVENT_TYPES.DAMAGE_EVENT,
      sender: '@me:x',
      content: { target_id: 't-2', delta: -3, kind: 'damage' },
    });
    expect(sm.damageLog).toHaveLength(0);
  });
});

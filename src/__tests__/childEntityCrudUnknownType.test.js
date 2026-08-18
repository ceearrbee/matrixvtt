/**
 * Defensive: child-entity-crud refuses to dispatch on an unknown
 * eventType with a clear error naming the type, rather than calling
 * `undefined(...)` and surfacing a generic STATE_WRITE toast.
 *
 * This is the bug class that masked the missing `_CHILD_WRITERS[TOKEN]`
 * entry for weeks: a TypeError caught and surfaced as "Could not save
 * changes to Matrix" with no hint at the real cause.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveChildEntity } from '../ui/child-entity-crud.js';
import { withFacade } from './helpers/withFacade.js';

function captureError() {
  const events = [];
  const handler = (e) => events.push(e.detail);
  window.addEventListener('vtt:error', handler);
  return {
    events,
    cleanup: () => window.removeEventListener('vtt:error', handler),
  };
}

describe('saveChildEntity - unknown eventType', () => {
  let cap;
  beforeEach(() => { cap = captureError(); });

  it('returns false and surfaces an error whose message names the unknown eventType', async () => {
    const ui = {
      state: withFacade({ isGM: () => true, sendStateEvent: vi.fn() }),
      _toast: vi.fn(),
    };
    const ok = await saveChildEntity(ui, {
      eventType: 'com.vtt.bogus',
      collection: 'bogus',
      id: 'b-1',
      entity: { x: 1 },
      noun: 'bogus',
      verb: 'create',
    });
    expect(ok).toBe(false);
    expect(cap.events.length).toBeGreaterThan(0);
    const combined = cap.events.map(e => e.error?.message || e.message).join(' ');
    expect(combined).toContain('com.vtt.bogus');
    cap.cleanup();
  });
});

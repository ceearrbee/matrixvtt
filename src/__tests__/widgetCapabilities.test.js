/**
 * WidgetManager - capability verification after requestCapabilities()
 *
 * verifyCapabilities(widgetApi, required) checks whether all required
 * capabilities were actually granted. Missing capabilities are returned
 * and vtt:capabilities-denied is dispatched with the missing list.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyCapabilities, buildCapabilities } from '../widget/capabilities.js';
import { EVENT_TYPES, VTT_EVENTS } from '../utils/constants.js';

function makeApi(grantedRaw) {
  return {
    hasCapabilities: vi.fn(caps =>
      Array.isArray(caps)
        ? caps.every(c => grantedRaw.includes(c))
        : grantedRaw.includes(caps)
    ),
  };
}

function collectEvents(name) {
  const events = [];
  const handler = e => events.push(e);
  window.addEventListener(name, handler);
  return { events, cleanup: () => window.removeEventListener(name, handler) };
}

const REQUIRED = [
  `org.matrix.msc2762.send.state_event:${EVENT_TYPES.TOKEN}`,
  `org.matrix.msc2762.send.state_event:${EVENT_TYPES.SETTINGS}`,
  `org.matrix.msc2762.receive.state_event:${EVENT_TYPES.TOKEN}`,
];

describe('buildCapabilities', () => {
  it('includes m.reaction receive capability', () => {
    expect(buildCapabilities()).toContain('org.matrix.msc2762.receive.event:m.reaction');
  });

  it('includes m.reaction send capability', () => {
    expect(buildCapabilities()).toContain('org.matrix.msc2762.send.event:m.reaction');
  });
});

describe('verifyCapabilities', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns empty array when all required capabilities are granted', () => {
    const api = makeApi(REQUIRED);
    const missing = verifyCapabilities(api, REQUIRED);
    expect(missing).toEqual([]);
  });

  it('returns the missing capability names when some are denied', () => {
    const api = makeApi([`org.matrix.msc2762.receive.state_event:${EVENT_TYPES.TOKEN}`]);
    const missing = verifyCapabilities(api, REQUIRED);
    expect(missing).toContain(`org.matrix.msc2762.send.state_event:${EVENT_TYPES.TOKEN}`);
    expect(missing).toContain(`org.matrix.msc2762.send.state_event:${EVENT_TYPES.SETTINGS}`);
    expect(missing).not.toContain(`org.matrix.msc2762.receive.state_event:${EVENT_TYPES.TOKEN}`);
  });

  it('dispatches vtt:capabilities-denied when capabilities are missing', () => {
    const api = makeApi([]);
    const denied = collectEvents(VTT_EVENTS.CAPABILITIES_DENIED);

    verifyCapabilities(api, REQUIRED);

    denied.cleanup();
    expect(denied.events.length).toBe(1);
  });

  it('includes missing list in the event detail', () => {
    const api = makeApi([]);
    const denied = collectEvents(VTT_EVENTS.CAPABILITIES_DENIED);

    verifyCapabilities(api, REQUIRED);

    denied.cleanup();
    expect(denied.events[0].detail.missing).toEqual(expect.arrayContaining(REQUIRED));
  });

  it('does not dispatch vtt:capabilities-denied when all granted', () => {
    const api = makeApi(REQUIRED);
    const denied = collectEvents(VTT_EVENTS.CAPABILITIES_DENIED);

    verifyCapabilities(api, REQUIRED);

    denied.cleanup();
    expect(denied.events.length).toBe(0);
  });
});

describe('buildCapabilities - Yjs transport', () => {
  // All entity state rides in Yjs since the CRDT migration. Without
  // these capabilities the widget can neither load nor publish the
  // snapshot, so settings (including gm_user_ids), maps, and tokens
  // silently stay empty: "No GMs assigned" for the room creator.
  it('includes send+receive for the snapshot state event', () => {
    const caps = buildCapabilities();
    expect(caps).toContain('org.matrix.msc2762.receive.state_event:com.matrixvtt.yjs.snapshot');
    expect(caps).toContain('org.matrix.msc2762.send.state_event:com.matrixvtt.yjs.snapshot');
  });

  it('includes send+receive for the live update and sync-vector room events', () => {
    const caps = buildCapabilities();
    for (const type of ['com.matrixvtt.yjs.update', 'com.matrixvtt.yjs.sync_vector']) {
      expect(caps).toContain(`org.matrix.msc2762.receive.event:${type}`);
      expect(caps).toContain(`org.matrix.msc2762.send.event:${type}`);
    }
  });
});

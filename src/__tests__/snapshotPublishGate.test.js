/**
 * Only clients that can write room state (PL >= 50) may publish Yjs
 * snapshots. canEditRoomState() is async; testing the unawaited
 * function object made the gate pass for everyone, so player clients
 * tried to publish and took a 403 on every snapshot cycle.
 */
import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { publishYjsSnapshot, republishSnapshotIfMissing } from '../state/yjs-snapshot-publish.js';

function makeSm(canEdit) {
  const doc = new Y.Doc();
  doc.getMap('settings').set('', { name: 'x' });
  return /** @type {any} */ ({
    yjs: { doc },
    widgetManager: {
      canEditRoomState: vi.fn().mockResolvedValue(canEdit),
      getApi: vi.fn().mockReturnValue(null),
    },
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
}

describe('publishYjsSnapshot permission gate', () => {
  it('does not publish when canEditRoomState resolves false', async () => {
    const sm = makeSm(false);
    const ok = await publishYjsSnapshot(sm);
    expect(ok).toBe(false);
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('publishes when canEditRoomState resolves true', async () => {
    const sm = makeSm(true);
    const ok = await publishYjsSnapshot(sm);
    expect(ok).toBe(true);
    expect(sm.sendStateEvent).toHaveBeenCalled();
  });
});

describe('republishSnapshotIfMissing permission gate', () => {
  it('short-circuits for non-editors without touching the api', async () => {
    const sm = makeSm(false);
    const ok = await republishSnapshotIfMissing(sm);
    expect(ok).toBe(false);
    expect(sm.widgetManager.getApi).not.toHaveBeenCalled();
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('proceeds to the probe for editors', async () => {
    const sm = makeSm(true);
    await republishSnapshotIfMissing(sm);
    expect(sm.widgetManager.getApi).toHaveBeenCalled();
  });
});

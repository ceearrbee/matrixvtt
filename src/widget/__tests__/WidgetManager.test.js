/**
 * WidgetManager unit tests - error dispatch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeManager(overrides = {}) {
  const widgetApi = {
    receiveStateEvents: vi.fn().mockResolvedValue([]),
    sendStateEvent: vi.fn().mockResolvedValue({}),
    ...overrides,
  };

  vi.doMock('@matrix-widget-toolkit/api', () => ({
    WidgetApiImpl: { create: vi.fn() }
  }));

  return { widgetApi };
}

async function getManager(widgetApiOverrides = {}) {
  const { widgetApi } = makeManager(widgetApiOverrides);
  const { WidgetManager } = await import('../WidgetManager.js');
  const manager = new WidgetManager();
  manager.widgetApi = widgetApi;
  manager.roomId = '!room:example.com';
  manager.userId = '@gm:example.com';
  manager.isStandalone = false;
  manager._roomIdsSupported = false; // skip roomIds probe path
  return { manager, widgetApi };
}

describe('WidgetManager.setRoomPowerLevels', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('dispatches vtt:error when receiveStateEvents throws', async () => {
    const { manager } = await getManager({
      receiveStateEvents: vi.fn().mockRejectedValue(new Error('forbidden'))
    });

    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await manager.setRoomPowerLevels(['@gm:example.com']);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when receiveStateEvents fails', async () => {
    const { manager } = await getManager({
      receiveStateEvents: vi.fn().mockRejectedValue(new Error('forbidden'))
    });

    await expect(manager.setRoomPowerLevels(['@gm:example.com'])).resolves.not.toThrow();
  });

  // Element rejects roomIds-scoped reads without a timeline capability.
  // The wizard's power-level write must fall back to the implicit-room
  // read instead of surfacing "Network error" and skipping the write.
  it('falls back to the implicit-room read when the roomIds read is rejected', async () => {
    const { manager, widgetApi } = await getManager({
      receiveStateEvents: vi.fn(async (_type, opts = {}) => {
        if (opts.roomIds) throw new Error('not allowed');
        return [{ content: { users: { '@gm:example.com': 100 }, users_default: 0 } }];
      }),
    });
    manager._roomIdsSupported = null;

    await manager.setRoomPowerLevels(['@gm:example.com']);

    expect(widgetApi.sendStateEvent).toHaveBeenCalledTimes(1);
    const [type, content] = widgetApi.sendStateEvent.mock.calls[0];
    expect(type).toBe('m.room.power_levels');
    expect(content.users['@gm:example.com']).toBe(100);
  });
});

describe('WidgetManager.redactEvent', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('sends m.room.redaction through the widget API', async () => {
    const { manager, widgetApi } = await getManager({
      sendRoomEvent: vi.fn().mockResolvedValue({ event_id: '$r1' }),
    });
    widgetApi.sendRoomEvent = vi.fn().mockResolvedValue({ event_id: '$r1' });

    await manager.redactEvent('$target1');

    expect(widgetApi.sendRoomEvent).toHaveBeenCalledWith('m.room.redaction', {
      redacts: '$target1',
    });
  });
});

describe('WidgetManager.getRoomMembers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('dispatches vtt:error when legacy fallback also fails', async () => {
    const { manager } = await getManager({
      receiveStateEvents: vi.fn().mockRejectedValue(new Error('network'))
    });

    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await manager.getRoomMembers();

    expect(errors).toHaveLength(1);
  });

  it('returns empty array when legacy fallback fails', async () => {
    const { manager } = await getManager({
      receiveStateEvents: vi.fn().mockRejectedValue(new Error('network'))
    });

    const result = await manager.getRoomMembers();
    expect(result).toEqual([]);
  });
});

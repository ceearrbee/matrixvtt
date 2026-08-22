/**
 * setJoinRule parity: both room managers flip m.room.join_rules the same
 * way, so the invite modal's "let anyone with the link request to join"
 * action works in widget mode and standalone alike.
 */
import { describe, it, expect, vi } from 'vitest';
import { ClientManager } from '../client/ClientManager.js';
import { setJoinRule as adapterSetJoinRule } from '../widget/room-adapter.js';
import { buildCapabilities } from '../widget/capabilities.js';
import { EVENT_TYPES } from '../utils/constants.js';

describe('ClientManager.setJoinRule', () => {
  it('writes the join rule as a room state event', async () => {
    const cm = Object.create(ClientManager.prototype);
    cm.roomId = '!r:hs';
    cm.sendStateEvent = vi.fn().mockResolvedValue({});
    await cm.setJoinRule('knock');
    expect(cm.sendStateEvent).toHaveBeenCalledWith(EVENT_TYPES.JOIN_RULES, '', { join_rule: 'knock' });
  });

  it('rejects a rule the app does not offer', async () => {
    const cm = Object.create(ClientManager.prototype);
    cm.sendStateEvent = vi.fn();
    await expect(cm.setJoinRule('nonsense')).rejects.toThrow();
    expect(cm.sendStateEvent).not.toHaveBeenCalled();
  });
});

describe('room-adapter setJoinRule (widget mode)', () => {
  it('writes the same state event through the widget API', async () => {
    const wm = { sendStateEvent: vi.fn().mockResolvedValue({}) };
    await adapterSetJoinRule(wm, 'knock');
    expect(wm.sendStateEvent).toHaveBeenCalledWith(EVENT_TYPES.JOIN_RULES, '', { join_rule: 'knock' });
  });
});

describe('widget capabilities cover join rules', () => {
  it('reads and writes m.room.join_rules', () => {
    const caps = buildCapabilities();
    expect(caps).toContain(`org.matrix.msc2762.receive.state_event:${EVENT_TYPES.JOIN_RULES}`);
    expect(caps).toContain(`org.matrix.msc2762.send.state_event:${EVENT_TYPES.JOIN_RULES}`);
  });
});

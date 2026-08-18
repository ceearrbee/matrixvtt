/**
 * broadcastPing forwards a color to the room as part of an
 * m.room.message-shaped event. Validate the color against a strict hex
 * pattern so a stray caller (or future XSS sink that surfaces the value)
 * cannot push arbitrary strings into Matrix state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapRenderer } from '../map-renderer.js';

function makeMr(sendRoomEvent) {
  const mr = Object.create(MapRenderer.prototype);
  mr._pingsApi = { addPing: vi.fn() };
  mr.state = {
    map: { width_cells: 10, height_cells: 10, cell_px: 50 },
    sendRoomEvent,
  };
  return mr;
}

describe('broadcastPing color validation', () => {
  let send;
  beforeEach(() => { send = vi.fn().mockResolvedValue({}); });

  it('forwards a valid 6-digit hex color unchanged', () => {
    makeMr(send).broadcastPing(50, 50, '#aabbcc');
    expect(send.mock.calls[0][1].color).toBe('#aabbcc');
  });

  it('replaces a malformed color with the default', () => {
    makeMr(send).broadcastPing(50, 50, 'red; DROP TABLE');
    expect(send.mock.calls[0][1].color).toBe('#ff4444');
  });

  it('replaces an undefined color with the default', () => {
    makeMr(send).broadcastPing(50, 50, undefined);
    expect(send.mock.calls[0][1].color).toBe('#ff4444');
  });

  it('rejects 3-digit hex shorthand to keep the regex strict', () => {
    makeMr(send).broadcastPing(50, 50, '#abc');
    expect(send.mock.calls[0][1].color).toBe('#ff4444');
  });
});

/**
 * Announcements are written in Markdown - `**15**` for a roll total,
 * `**Orc War Boss**` for a damaged token. They travelled as a bare
 * `m.text` body with no `format`, so the log rendered the asterisks
 * literally: "crb rolled 1d20: **15** (15)". The composer path already
 * pairs a Markdown body with a rendered `formatted_body`; every
 * announcement takes the same road.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatIntegrator } from '../chat-integrator.js';
import { EVENT_TYPES } from '../utils/constants.js';

const widgetManager = { userId: '@gm:server', isStandalone: true, sendRoomEvent: vi.fn() };

let chat;
let state;
beforeEach(() => {
  localStorage.clear();
  state = { characters: new Map(), sendRoomEvent: vi.fn().mockResolvedValue(undefined) };
  chat = new ChatIntegrator(widgetManager, state, { roll: vi.fn() });
});

function lastMessage() {
  const call = state.sendRoomEvent.mock.calls.at(-1);
  expect(call?.[0]).toBe(EVENT_TYPES.ROOM_MESSAGE);
  return call[1];
}

describe('announcements carry rendered Markdown', () => {
  it('a roll total reaches the log as bold, not as asterisks', async () => {
    await chat._send('🎲 crb rolled 1d20: **15** (15)');
    const content = lastMessage();
    expect(content.body).toContain('**15**');
    expect(content.format).toBe('org.matrix.custom.html');
    expect(content.formatted_body).toContain('<strong>15</strong>');
    expect(content.formatted_body).not.toContain('**15**');
  });

  it('a plain announcement pays nothing for a format it does not need', async () => {
    await chat._send('Combat has ended.');
    const content = lastMessage();
    expect(content.body).toBe('Combat has ended.');
    expect(content.format).toBeUndefined();
    expect(content.formatted_body).toBeUndefined();
  });
});

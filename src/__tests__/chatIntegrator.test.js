/**
 * ChatIntegrator Tests - parsing, dice roll execution, and announcement persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatIntegrator } from '../chat-integrator.js';

const mockWidgetManager = { userId: '@gm:server', isStandalone: true, sendRoomEvent: vi.fn() };
const mockState = { characters: new Map(), sendRoomEvent: vi.fn() };

function makeDiceRoller(rolls = [10], modifier = 0, result = 10) {
  return { roll: vi.fn().mockReturnValue({ rolls, modifier, result }) };
}

let chat;
let mockDiceRoller;
beforeEach(() => {
  localStorage.clear();
  mockDiceRoller = makeDiceRoller();
  mockWidgetManager.sendRoomEvent.mockReset();
  mockState.sendRoomEvent.mockReset();
  chat = new ChatIntegrator(mockWidgetManager, mockState, mockDiceRoller);
});

describe('ChatIntegrator.parseDiceNotation', () => {
  it('parses valid notation', () => {
    expect(chat.parseDiceNotation('1d20')).toMatchObject({ count: 1, sides: 20, modifier: 0 });
    expect(chat.parseDiceNotation('2d6+3')).toMatchObject({ count: 2, sides: 6, modifier: 3 });
    expect(chat.parseDiceNotation('1d8-2')).toMatchObject({ count: 1, sides: 8, modifier: -2 });
  });

  it('returns null for invalid notation', () => {
    expect(chat.parseDiceNotation('invalid')).toBeNull();
    expect(chat.parseDiceNotation('d20')).toBeNull();
    expect(chat.parseDiceNotation('')).toBeNull();
  });

  it('includes notation field', () => {
    const result = chat.parseDiceNotation('2d6+3');
    expect(result.notation).toBe('2d6+3');
  });

  it('parses uppercase dice notation (2D6+3)', () => {
    // The regex has the /i flag, so uppercase D is accepted
    const result = chat.parseDiceNotation('2D6+3');
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ count: 2, sides: 6, modifier: 3 });
  });

  it('returns null for notation with internal spaces (1d20 + 3)', () => {
    // parseDiceNotation does not strip internal spaces - spaces inside make it invalid
    expect(chat.parseDiceNotation('1d20 + 3')).toBeNull();
  });

  it('parseDiceRollCommand with compact notation "1d20+3" works', () => {
    expect(chat.parseDiceRollCommand('/roll 1d20+3')).not.toBeNull();
    expect(chat.parseDiceRollCommand('/roll 2d6+3')).toMatchObject({ count: 2, sides: 6, modifier: 3 });
  });

  it('/roll with spaces around operator ("1d20 + 3") returns null - spaces not supported in notation', () => {
    // parseDiceRollCommand does match[1].trim() but "1d20 + 3" still fails parseDiceNotation
    expect(chat.parseDiceRollCommand('/roll 1d20 + 3')).toBeNull();
  });
});

describe('ChatIntegrator.parseDiceRollCommand', () => {
  it('recognises /roll prefix', () => {
    expect(chat.parseDiceRollCommand('/roll 1d20')).not.toBeNull();
  });

  it('recognises /r prefix', () => {
    expect(chat.parseDiceRollCommand('/r 2d6+5')).not.toBeNull();
  });

  it('recognises !roll prefix', () => {
    expect(chat.parseDiceRollCommand('!roll 1d8')).not.toBeNull();
  });

  it('recognises !r prefix', () => {
    expect(chat.parseDiceRollCommand('!r 3d6-1')).not.toBeNull();
  });

  it('is case-insensitive for the prefix', () => {
    expect(chat.parseDiceRollCommand('/ROLL 1d20')).not.toBeNull();
  });

  it('returns null for plain messages', () => {
    expect(chat.parseDiceRollCommand('Hello world')).toBeNull();
    expect(chat.parseDiceRollCommand('1d20')).toBeNull();
    expect(chat.parseDiceRollCommand('/roll')).toBeNull();
  });

  it('returns null when notation is invalid', () => {
    expect(chat.parseDiceRollCommand('/roll not-dice')).toBeNull();
  });

  it('accepts uppercase dice notation via /ROLL 2D6+3', () => {
    const result = chat.parseDiceRollCommand('/ROLL 2D6+3');
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ count: 2, sides: 6, modifier: 3 });
  });
});

describe('ChatIntegrator announcement persistence', () => {
  it('loads legacy global key as upgrade fallback', () => {
    localStorage.setItem('mvtt_announcements', JSON.stringify({ damage: false, combat: true }));
    const c2 = new ChatIntegrator(mockWidgetManager, mockState, mockDiceRoller);
    expect(c2.announcements.damage).toBe(false);
    expect(c2.announcements.combat).toBe(true);
  });

  it('persists settings via setAnnouncementSettings', () => {
    chat.setAnnouncementSettings({ damage: false });
    const saved = JSON.parse(localStorage.getItem('mvtt_announcements:@gm:server'));
    expect(saved.damage).toBe(false);
  });

  it('falls back to defaults on invalid localStorage data', () => {
    localStorage.setItem('mvtt_announcements:@gm:server', 'not-json{');
    const c3 = new ChatIntegrator(mockWidgetManager, mockState, mockDiceRoller);
    expect(c3.announcements.damage).toBe(true);
  });
});

// ─────────────────────────────────────────────
// executeDiceRollFromChat - real dice invocation
// ─────────────────────────────────────────────

describe('ChatIntegrator.executeDiceRollFromChat', () => {
  it('calls diceRoller.roll with the notation string', async () => {
    const command = chat.parseDiceNotation('1d20+3');
    await chat.executeDiceRollFromChat(command, '@player:server');
    // Verify the exact notation string is forwarded to the dice roller
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d20+3');
  });

  it('calls diceRoller.roll with plain 1d20 notation (no modifier)', async () => {
    const command = chat.parseDiceNotation('1d20');
    await chat.executeDiceRollFromChat(command, '@player:server');
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d20');
  });

  it('calls diceRoller.roll with negative modifier notation', async () => {
    const command = chat.parseDiceNotation('1d8-2');
    await chat.executeDiceRollFromChat(command, '@player:server');
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d8-2');
  });

  it('calls diceRoller.roll with multi-dice notation', async () => {
    const command = chat.parseDiceNotation('4d6+1');
    await chat.executeDiceRollFromChat(command, '@player:server');
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('4d6+1');
  });

  it('posts roll result to chat via sendRoomEvent', async () => {
    mockDiceRoller.roll.mockReturnValue({ rolls: [15], modifier: 3, result: 18 });
    const command = chat.parseDiceNotation('1d20+3');
    await chat.executeDiceRollFromChat(command, '@player:server');
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
    const [type, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(type).toBe('m.room.message');
    expect(content.body).toMatch(/18/);
    expect(content.body).toMatch(/1d20\+3/);
  });

  it('omits modifier string when modifier is 0', async () => {
    mockDiceRoller.roll.mockReturnValue({ rolls: [7], modifier: 0, result: 7 });
    const command = chat.parseDiceNotation('1d8');
    await chat.executeDiceRollFromChat(command, '@gm:server');
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d8');
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    // No "+0" in the output
    expect(content.body).not.toMatch(/\+0/);
    expect(content.body).toMatch(/7/);
  });

  it('uses character name when sender has claimed a character', async () => {
    const state = {
      characters: new Map([
        ['chr-1', { name: 'Aria', claimed_by_user_id: '@player:server' }]
      ]),
      sendRoomEvent: mockState.sendRoomEvent,
    };
    const localChat = new ChatIntegrator(mockWidgetManager, state, mockDiceRoller);
    const command = localChat.parseDiceNotation('1d20');
    await localChat.executeDiceRollFromChat(command, '@player:server');
    // Verify the correct notation was rolled
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d20');
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/Aria/);
  });

  it('falls back to user localpart when sender has no character', async () => {
    const command = chat.parseDiceNotation('1d6');
    await chat.executeDiceRollFromChat(command, '@druid:server');
    // Verify the correct notation was rolled
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d6');
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/druid/);
  });

  it('result of exactly 0 (natural roll minus large modifier) is shown correctly', async () => {
    // 1d1-1: die rolls 1, modifier -1, result 0
    mockDiceRoller.roll.mockReturnValue({ rolls: [1], modifier: -1, result: 0 });
    const command = chat.parseDiceNotation('1d1-1');
    await chat.executeDiceRollFromChat(command, '@player:server');
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d1-1');
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/0/);
  });

  it('natural 1 on d20 is shown in output', async () => {
    mockDiceRoller.roll.mockReturnValue({ rolls: [1], modifier: 0, result: 1 });
    const command = chat.parseDiceNotation('1d20');
    await chat.executeDiceRollFromChat(command, '@player:server');
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d20');
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/1/);
  });

  it('natural 20 on d20 is shown in output', async () => {
    mockDiceRoller.roll.mockReturnValue({ rolls: [20], modifier: 0, result: 20 });
    const command = chat.parseDiceNotation('1d20');
    await chat.executeDiceRollFromChat(command, '@player:server');
    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d20');
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/20/);
  });
});

// ─────────────────────────────────────────────
// handleTimelineEvent - end-to-end dispatch
// ─────────────────────────────────────────────

describe('ChatIntegrator.handleTimelineEvent', () => {
  it('dispatches vtt:chat-message with correct sender and body', async () => {
    const events = [];
    window.addEventListener('vtt:chat-message', (e) => events.push(e.detail), { once: true });

    await chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@other:server',
      content: { msgtype: 'm.text', body: 'Hello party!' }
    });

    expect(events).toHaveLength(1);
    expect(events[0].sender).toBe('@other:server');
    expect(events[0].body).toBe('Hello party!');
  });

  it('does NOT dispatch vtt:chat-message for messages sent by this user', async () => {
    const events = [];
    const handler = (e) => events.push(e.detail);
    window.addEventListener('vtt:chat-message', handler);

    await chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@gm:server', // same as mockWidgetManager.userId
      content: { msgtype: 'm.text', body: 'My own message' }
    });

    window.removeEventListener('vtt:chat-message', handler);
    expect(events).toHaveLength(0);
  });

  it('executes dice roll when message is a /roll command', async () => {
    mockDiceRoller.roll.mockReturnValue({ rolls: [12], modifier: 0, result: 12 });

    await chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@player:server',
      content: { msgtype: 'm.text', body: '/roll 1d20' }
    });

    expect(mockDiceRoller.roll).toHaveBeenCalledWith('1d20');
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
  });

  it('ignores non-message event types', async () => {
    await chat.handleTimelineEvent({
      type: 'm.room.member',
      sender: '@player:server',
      content: { membership: 'join' }
    });
    expect(mockDiceRoller.roll).not.toHaveBeenCalled();
  });

  it('does not crash on whitespace-only body (no /roll command)', async () => {
    await expect(chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@player:server',
      content: { msgtype: 'm.text', body: '   ' }
    })).resolves.not.toThrow();
    expect(mockDiceRoller.roll).not.toHaveBeenCalled();
  });

  it('does not roll dice for a message with XSS payload', async () => {
    await chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@attacker:server',
      content: { msgtype: 'm.text', body: '<script>alert("xss")</script>' }
    });
    // XSS payload is not a dice command - no roll should occur
    expect(mockDiceRoller.roll).not.toHaveBeenCalled();
  });

  it('XSS in message body is stored verbatim as string (not executed via dispatchEvent)', async () => {
    const events = [];
    window.addEventListener('vtt:chat-message', (e) => events.push(e.detail), { once: true });
    const xssPayload = '<script>alert("xss")</script>';
    await chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@attacker:server',
      content: { msgtype: 'm.text', body: xssPayload }
    });
    // The body is passed through as a string - rendering layer is responsible for escaping
    expect(events[0].body).toBe(xssPayload);
  });

  it('does not crash on a very long message (>10,000 chars)', async () => {
    const longBody = 'A'.repeat(11000);
    await expect(chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@player:server',
      content: { msgtype: 'm.text', body: longBody }
    })).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────
// init / destroy lifecycle
// ─────────────────────────────────────────────

describe('ChatIntegrator.init / destroy lifecycle', () => {
  it('init registers matrix:timeline-event on window', () => {
    const spy = vi.spyOn(window, 'addEventListener');
    chat.init();
    expect(spy).toHaveBeenCalledWith('matrix:timeline-event', expect.any(Function));
    spy.mockRestore();
  });

  it('destroy removes the listener and nulls _onTimelineEvent', () => {
    chat.init();
    expect(chat._onTimelineEvent).not.toBeNull();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    chat.destroy();
    expect(removeSpy).toHaveBeenCalledWith('matrix:timeline-event', expect.any(Function));
    expect(chat._onTimelineEvent).toBeNull();
    removeSpy.mockRestore();
  });

  it('destroy is idempotent - calling twice does not throw', () => {
    chat.init();
    chat.destroy();
    expect(() => chat.destroy()).not.toThrow();
  });

  it('after destroy, dispatched matrix:timeline-event does not invoke roll handler', async () => {
    chat.init();
    chat.destroy();
    window.dispatchEvent(new CustomEvent('matrix:timeline-event', {
      detail: { type: 'm.room.message', sender: '@player:server',
                content: { msgtype: 'm.text', body: '/roll 1d20' } }
    }));
    await new Promise(r => setTimeout(r, 0));
    expect(mockDiceRoller.roll).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// executeDiceRollFromChat - error propagation
// ─────────────────────────────────────────────

describe('ChatIntegrator.executeDiceRollFromChat - error propagation', () => {
  it('propagates exception when diceRoller.roll() throws', async () => {
    mockDiceRoller.roll.mockImplementation(() => { throw new Error('bad notation'); });
    const command = chat.parseDiceNotation('1d20');
    await expect(chat.executeDiceRollFromChat(command, '@player:server'))
      .rejects.toThrow('bad notation');
  });
});

// ─────────────────────────────────────────────
// getCharacterNameForUser
// ─────────────────────────────────────────────

describe('ChatIntegrator.getCharacterNameForUser', () => {
  it('returns null when userId is null', () => {
    expect(chat.getCharacterNameForUser(null)).toBeNull();
  });

  it('returns null when userId is undefined', () => {
    expect(chat.getCharacterNameForUser(undefined)).toBeNull();
  });

  it('returns null when userId is empty string', () => {
    expect(chat.getCharacterNameForUser('')).toBeNull();
  });

  it('does not match character with claimed_by_user_id: undefined', () => {
    const state = {
      characters: new Map([
        ['chr-1', { name: 'Aria', claimed_by_user_id: undefined }]
      ])
    };
    const localChat = new ChatIntegrator(mockWidgetManager, state, mockDiceRoller);
    expect(localChat.getCharacterNameForUser('@player:server')).toBeNull();
  });

  it('does not match character with claimed_by_user_id: null', () => {
    const state = {
      characters: new Map([
        ['chr-1', { name: 'Aria', claimed_by_user_id: null }]
      ])
    };
    const localChat = new ChatIntegrator(mockWidgetManager, state, mockDiceRoller);
    expect(localChat.getCharacterNameForUser('@player:server')).toBeNull();
  });

  it('returns name for exactly matching userId', () => {
    const state = {
      characters: new Map([
        ['chr-1', { name: 'Aria', claimed_by_user_id: '@player:server' }]
      ])
    };
    const localChat = new ChatIntegrator(mockWidgetManager, state, mockDiceRoller);
    expect(localChat.getCharacterNameForUser('@player:server')).toBe('Aria');
  });
});

// ─────────────────────────────────────────────
// Announcement gates
// ─────────────────────────────────────────────

describe('ChatIntegrator announcement gates', () => {
  beforeEach(() => { mockState.sendRoomEvent.mockReset(); });

  it('announceDamage sends when damage announcements enabled', async () => {
    chat.announcements.damage = true;
    await chat.announceDamage('Goblin', 5, 10, 20);
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/Goblin/);
    expect(content.body).toMatch(/5 damage/);
  });

  it('announceDamage is silent when damage announcements disabled', async () => {
    chat.announcements.damage = false;
    await chat.announceDamage('Goblin', 5, 10, 20);
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('announceHeal sends when damage announcements enabled', async () => {
    chat.announcements.damage = true;
    await chat.announceHeal('Hero', 8, 25, 30);
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/Hero/);
    expect(content.body).toMatch(/8 HP/);
  });

  it('announceHeal is silent when damage announcements disabled', async () => {
    chat.announcements.damage = false;
    await chat.announceHeal('Hero', 8, 25, 30);
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('announceCombat sends when combat announcements enabled', async () => {
    chat.announcements.combat = true;
    await chat.announceCombat('Combat has started!');
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
  });

  it('announceCombat is silent when combat announcements disabled', async () => {
    chat.announcements.combat = false;
    await chat.announceCombat('Combat has started!');
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('announceMapChange sends when mapChanges announcements enabled', async () => {
    chat.announcements.mapChanges = true;
    await chat.announceMapChange('Dungeon Level 2');
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/Dungeon Level 2/);
  });

  it('announceMapChange is silent when mapChanges disabled', async () => {
    chat.announcements.mapChanges = false;
    await chat.announceMapChange('Dungeon Level 2');
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('announceInitiativeOrder formats order list correctly', async () => {
    chat.announcements.combat = true;
    await chat.announceInitiativeOrder([
      { name: 'Aria', initiative: 20 },
      { name: 'Goblin', initiative: 12 }
    ]);
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/1\. Aria \(20\)/);
    expect(content.body).toMatch(/2\. Goblin \(12\)/);
  });

  it('announceTurn includes round and name', async () => {
    chat.announcements.combat = true;
    await chat.announceTurn(3, 'Aria');
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/Round 3/);
    expect(content.body).toMatch(/Aria/);
  });

  it('announceInitiativeOrder with empty array sends message without entries', async () => {
    chat.announcements.combat = true;
    await chat.announceInitiativeOrder([]);
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
    // Should not crash - message still sent (possibly empty list)
  });

  it('announceTurn with round=0 (edge: before first round) does not crash', async () => {
    chat.announcements.combat = true;
    await expect(chat.announceTurn(0, 'Goblin')).resolves.not.toThrow();
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/Goblin/);
  });

  it('announceTurn with very large round number does not crash', async () => {
    chat.announcements.combat = true;
    await expect(chat.announceTurn(9999, 'Dragon')).resolves.not.toThrow();
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/9999/);
    expect(content.body).toMatch(/Dragon/);
  });
});

// ─────────────────────────────────────────────
// postDiceRollToChat
// ─────────────────────────────────────────────

describe('ChatIntegrator.postDiceRollToChat', () => {
  it('sends formatted roll message with expression and total', async () => {
    await chat.postDiceRollToChat({ expression: '2d6+3', results: [4, 5], modifiers: 3, total: 12, label: null });
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/2d6\+3/);
    expect(content.body).toMatch(/12/);
  });

  it('includes label in brackets when provided', async () => {
    await chat.postDiceRollToChat({ expression: '1d20', results: [15], modifiers: 0, total: 15, label: 'Attack' });
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toContain('[Attack]');
  });

  it('omits brackets entirely when label is null', async () => {
    await chat.postDiceRollToChat({ expression: '1d6', results: [3], modifiers: 0, total: 3, label: null });
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).not.toContain('[');
  });

  it('shows modifier when non-zero', async () => {
    await chat.postDiceRollToChat({ expression: '1d8+2', results: [6], modifiers: 2, total: 8, label: null });
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toMatch(/\+2/);
  });

  it('omits modifier string when modifiers is 0', async () => {
    await chat.postDiceRollToChat({ expression: '1d6', results: [4], modifiers: 0, total: 4, label: null });
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).not.toMatch(/\+0/);
  });

  it('uses character name when getCurrentCharacter returns one', async () => {
    const stateWithChar = {
      characters: new Map(),
      getCurrentCharacter: () => ({ name: 'Aria' }),
      sendRoomEvent: mockState.sendRoomEvent,
    };
    const localChat = new ChatIntegrator(mockWidgetManager, stateWithChar, mockDiceRoller);
    await localChat.postDiceRollToChat({ expression: '1d20', results: [10], modifiers: 0, total: 10, label: null });
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toContain('Aria');
  });

  it('falls back to userId localpart when no character selected', async () => {
    // mockWidgetManager.userId = '@gm:server' → localpart = 'gm'
    await chat.postDiceRollToChat({ expression: '1d6', results: [3], modifiers: 0, total: 3, label: null });
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toContain('gm');
  });
});

// ─────────────────────────────────────────────
// announceMessage
// ─────────────────────────────────────────────

describe('ChatIntegrator.announceMessage', () => {
  it('sends message with ⚔️ prefix', async () => {
    await chat.announceMessage('Combat has started!');
    expect(mockState.sendRoomEvent).toHaveBeenCalledOnce();
    const [, content] = mockState.sendRoomEvent.mock.calls[0];
    expect(content.body).toContain('⚔️');
    expect(content.body).toContain('Combat has started!');
  });

  it('sends empty string without crashing', async () => {
    await expect(chat.announceMessage('')).resolves.not.toThrow();
  });
});

// ─── Pass 16 additions ────────────────────────────────────────────────────────

describe('ChatIntegrator._send - error suppression', () => {
  it('does not throw when sendRoomEvent rejects', async () => {
    mockState.sendRoomEvent.mockRejectedValueOnce(new Error('network failure'));
    await expect(chat._send('test message')).resolves.not.toThrow();
  });

  it('dispatches vtt:error when sendRoomEvent fails', async () => {
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });
    mockState.sendRoomEvent.mockRejectedValueOnce(new Error('timeout'));
    await chat._send('test');
    expect(errors).toHaveLength(1);
  });
});

describe('ChatIntegrator.announceInitiativeOrder - combat gate', () => {
  it('is silent when combat announcements are disabled', async () => {
    chat.announcements.combat = false;
    await chat.announceInitiativeOrder([{ name: 'Aria', initiative: 18 }]);
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
  });
});

describe('ChatIntegrator.announceTurn - combat gate', () => {
  it('is silent when combat announcements are disabled', async () => {
    chat.announcements.combat = false;
    await chat.announceTurn(1, 'Aria');
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
  });
});

describe('ChatIntegrator - historical event handling', () => {
  beforeEach(() => {
    mockState.sendRoomEvent.mockReset();
    mockDiceRoller.roll.mockReturnValue({ rolls: [10], modifier: 0, result: 10 });
  });

  it('_historical: true - dice roll suppressed', async () => {
    await chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@player:server',
      _historical: true,
      content: { msgtype: 'm.text', body: '/roll 1d12' }
    });

    expect(mockDiceRoller.roll).not.toHaveBeenCalled();
  });

  it('_historical: true - vtt:chat-message IS still dispatched (history is shown)', async () => {
    const events = [];
    window.addEventListener('vtt:chat-message', (e) => events.push(e.detail), { once: true });

    await chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@other:server',
      _historical: true,
      content: { msgtype: 'm.text', body: 'Old message' }
    });

    expect(events).toHaveLength(1);
    expect(events[0].historical).toBe(true);
    expect(events[0].body).toBe('Old message');
  });
});

// ─── announceInitiativeOrder guard ───────────────────────────────────────────

describe('ChatIntegrator.announceInitiativeOrder', () => {
  it('does not throw when order is null', async () => {
    chat.announcements = { combat: true };
    await expect(chat.announceInitiativeOrder(null)).resolves.not.toThrow();
  });

  it('does not throw when order is undefined', async () => {
    chat.announcements = { combat: true };
    await expect(chat.announceInitiativeOrder(undefined)).resolves.not.toThrow();
  });

  it('sends a message for a valid order', async () => {
    chat.announcements = { combat: true };
    const sendSpy = vi.spyOn(chat, '_send').mockResolvedValue();
    await chat.announceInitiativeOrder([{ name: 'Hero', initiative: 18 }]);
    expect(sendSpy).toHaveBeenCalledOnce();
  });
});

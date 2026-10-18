/**
 * ChatIntegrator Tests - timeline intake, announcements and their persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatIntegrator } from '../chat-integrator.js';

const mockWidgetManager = { userId: '@gm:server', isStandalone: true, sendRoomEvent: vi.fn() };
const mockState = { characters: new Map(), sendRoomEvent: vi.fn() };

let chat;
beforeEach(() => {
  localStorage.clear();
  mockWidgetManager.sendRoomEvent.mockReset();
  mockState.sendRoomEvent.mockReset();
  chat = new ChatIntegrator(mockWidgetManager, mockState);
});

afterEach(() => chat.destroy());


describe('ChatIntegrator announcement persistence', () => {
  it('loads legacy global key as upgrade fallback', () => {
    localStorage.setItem('mvtt_announcements', JSON.stringify({ damage: false, combat: true }));
    const c2 = new ChatIntegrator(mockWidgetManager, mockState);
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
    const c3 = new ChatIntegrator(mockWidgetManager, mockState);
    expect(c3.announcements.damage).toBe(true);
  });
});


// handleTimelineEvent - end-to-end dispatch

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

  it.each(['/roll 1d20', '/r 1d20', '!roll 2d6+1', '!r 1d8'])(
    'shows a roll command from another client as chat and sends nothing back (%s)',
    async (body) => {
      const events = [];
      const handler = (e) => events.push(e.detail);
      window.addEventListener('vtt:chat-message', handler);

      await chat.handleTimelineEvent({
        type: 'm.room.message',
        sender: '@player:server',
        content: { msgtype: 'm.text', body },
      });

      window.removeEventListener('vtt:chat-message', handler);
      expect(events.map((e) => e.body)).toEqual([body]);
      expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
    },
  );

  it('sends nothing for a roll command this user typed as plain text', async () => {
    await chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@gm:server',
      content: { msgtype: 'm.text', body: '!roll 1d20' },
    });
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('ignores non-message event types', async () => {
    await chat.handleTimelineEvent({
      type: 'm.room.member',
      sender: '@player:server',
      content: { membership: 'join' }
    });
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
  });

  it('does not crash on whitespace-only body', async () => {
    await expect(chat.handleTimelineEvent({
      type: 'm.room.message',
      sender: '@player:server',
      content: { msgtype: 'm.text', body: '   ' }
    })).resolves.not.toThrow();
    expect(mockState.sendRoomEvent).not.toHaveBeenCalled();
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

// init / destroy lifecycle

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

  it('after destroy, a dispatched matrix:timeline-event reaches no chat listener', async () => {
    const events = [];
    const handler = (e) => events.push(e.detail);
    window.addEventListener('vtt:chat-message', handler);
    chat.init();
    chat.destroy();
    window.dispatchEvent(new CustomEvent('matrix:timeline-event', {
      detail: { type: 'm.room.message', sender: '@player:server',
                content: { msgtype: 'm.text', body: 'hello' } }
    }));
    await new Promise(r => setTimeout(r, 0));
    window.removeEventListener('vtt:chat-message', handler);
    expect(events).toHaveLength(0);
  });
});


// Announcement gates

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

// postDiceRollToChat

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
    const localChat = new ChatIntegrator(mockWidgetManager, stateWithChar);
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

// announceMessage

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

// Pass 16 additions

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

// announceInitiativeOrder guard

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

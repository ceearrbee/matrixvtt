/**
 * Reaction events processed by timeline-intake populate
 * reactionsSignal with deduped, aggregated entries.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleTimelineEvent } from '../chat/timeline-intake.js';
import { reactionsSignal } from '../state/signals.js';

function makeReactionEvent(eventId, sender, targetId, key) {
  return {
    type: 'm.reaction',
    event_id: eventId,
    sender,
    content: {
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: targetId,
        key,
      },
    },
  };
}

const stubChat = { clientManager: { userId: '@me:m' } };

beforeEach(() => {
  reactionsSignal.value = new Map();
});

describe('handleTimelineEvent m.reaction', () => {
  it('adds a single reaction entry with count 1', async () => {
    const evt = makeReactionEvent('$r1', '@a:m', '$msg1', '👍');
    await handleTimelineEvent(stubChat, evt);

    const entries = reactionsSignal.value.get('$msg1');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ key: '👍', count: 1, senders: ['@a:m'] });
  });

  it('deduplicates same sender + same key (still count 1)', async () => {
    const evt1 = makeReactionEvent('$r1', '@a:m', '$msg1', '👍');
    const evt2 = makeReactionEvent('$r2', '@a:m', '$msg1', '👍');
    await handleTimelineEvent(stubChat, evt1);
    await handleTimelineEvent(stubChat, evt2);

    const entries = reactionsSignal.value.get('$msg1');
    expect(entries).toHaveLength(1);
    expect(entries[0].count).toBe(1);
    expect(entries[0].senders).toEqual(['@a:m']);
  });

  it('aggregates two different senders to count 2', async () => {
    const evt1 = makeReactionEvent('$r1', '@a:m', '$msg1', '👍');
    const evt2 = makeReactionEvent('$r2', '@b:m', '$msg1', '👍');
    await handleTimelineEvent(stubChat, evt1);
    await handleTimelineEvent(stubChat, evt2);

    const entries = reactionsSignal.value.get('$msg1');
    expect(entries).toHaveLength(1);
    expect(entries[0].count).toBe(2);
    expect(entries[0].senders).toContain('@a:m');
    expect(entries[0].senders).toContain('@b:m');
  });

  it('records myReactionEventId when sender is the local user', async () => {
    const evt = makeReactionEvent('$r1', '@me:m', '$msg1', '❤️');
    await handleTimelineEvent({ clientManager: { userId: '@me:m' } }, evt);

    const entries = reactionsSignal.value.get('$msg1');
    expect(entries[0].myReactionEventId).toBe('$r1');
  });

  it('does not set myReactionEventId for other senders', async () => {
    const evt = makeReactionEvent('$r1', '@other:m', '$msg1', '👍');
    await handleTimelineEvent(stubChat, evt);

    const entries = reactionsSignal.value.get('$msg1');
    expect(entries[0].myReactionEventId).toBeUndefined();
  });

  it('ignores reactions with wrong rel_type', async () => {
    const evt = {
      type: 'm.reaction',
      event_id: '$r1',
      sender: '@a:m',
      content: {
        'm.relates_to': { rel_type: 'm.replace', event_id: '$msg1', key: '👍' },
      },
    };
    await handleTimelineEvent(stubChat, evt);
    expect(reactionsSignal.value.get('$msg1')).toBeUndefined();
  });

  it('ignores reactions missing key', async () => {
    const evt = {
      type: 'm.reaction',
      event_id: '$r1',
      sender: '@a:m',
      content: {
        'm.relates_to': { rel_type: 'm.annotation', event_id: '$msg1' },
      },
    };
    await handleTimelineEvent(stubChat, evt);
    expect(reactionsSignal.value.get('$msg1')).toBeUndefined();
  });
});

describe('handleTimelineEvent m.room.message threadOf extraction', () => {
  it('dispatches threadOf=$root when message has m.thread relation', async () => {
    const dispatched = [];
    const orig = window.dispatchEvent.bind(window);
    vi.spyOn(window, 'dispatchEvent').mockImplementation((ev) => {
      if (ev.type === 'vtt:chat-message') dispatched.push(ev.detail);
      return orig(ev);
    });

    const evt = {
      type: 'm.room.message',
      event_id: '$reply1',
      sender: '@other:m',
      content: {
        msgtype: 'm.text',
        body: 'replying here',
        'm.relates_to': { rel_type: 'm.thread', event_id: '$root' },
      },
    };
    await handleTimelineEvent(stubChat, evt);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].threadOf).toBe('$root');

    vi.restoreAllMocks();
  });

  it('dispatches threadOf=null for a plain message with no relation', async () => {
    const dispatched = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((ev) => {
      if (ev.type === 'vtt:chat-message') dispatched.push(ev.detail);
    });

    const evt = {
      type: 'm.room.message',
      event_id: '$plain',
      sender: '@other:m',
      content: { msgtype: 'm.text', body: 'hello' },
    };
    await handleTimelineEvent(stubChat, evt);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].threadOf).toBeNull();

    vi.restoreAllMocks();
  });

  it('dispatches threadOf=null for a reaction relation (not a thread)', async () => {
    const dispatched = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((ev) => {
      if (ev.type === 'vtt:chat-message') dispatched.push(ev.detail);
    });

    const evt = {
      type: 'm.room.message',
      event_id: '$ann',
      sender: '@other:m',
      content: {
        msgtype: 'm.text',
        body: 'hi',
        'm.relates_to': { rel_type: 'm.annotation', event_id: '$msg', key: '👍' },
      },
    };
    await handleTimelineEvent(stubChat, evt);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].threadOf).toBeNull();

    vi.restoreAllMocks();
  });
});

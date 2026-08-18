/**
 * Reply-in-thread send path.
 *
 * 1. Clicking ↪ on a log row sets replyContextSignal to the row's
 *    thread-root event_id, sender, and a short preview.
 * 2. Sending a chat message while replyContextSignal is set includes
 *    m.relates_to in the outgoing payload and clears the signal.
 * 3. Sending while replyContextSignal is null omits m.relates_to.
 * 4. When the context is set, the chat input area renders a chip with
 *    an × button that clears the context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { replyContextSignal } from '../state/ui-signals.js';
import { reactionsSignal } from '../state/signals.js';
import { LogPanel } from '../ui/LogPanel.jsx';
import { DiceBar } from '../ui/DiceBar.jsx';
import { sendChatMessage } from '../ui/chat-send.js';

function makeUi(overrides = {}) {
  const sendRoomEvent = vi.fn().mockResolvedValue(undefined);
  return {
    activityLog: [],
    _logSearch: '',
    _logFilter: 'all',
    widgetManager: {
      userId: '@me:server',
      sendRoomEvent,
      isAppClient: true,
    },
    state: {
      tokens: new Map(),
      settings: null,
      isGM: () => false,
      sendRoomEvent,
    },
    _findTokenForSender: () => null,
    _log: vi.fn(),
    setSpeakAs: vi.fn(),
    ...overrides,
  };
}

describe('D4 reply-in-thread - LogPanel ↪ button sets replyContextSignal', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    reactionsSignal.value = new Map();
    replyContextSignal.value = null;
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    reactionsSignal.value = new Map();
    replyContextSignal.value = null;
  });

  it('clicking ↪ on a top-level row sets replyContextSignal to the row eventId', async () => {
    const ui = makeUi({
      activityLog: [
        { icon: '💬', html: 'hello', text: 'hello world', ts: '12:00', eventId: '$evt1', sender: '@alice:m', threadOf: null },
      ],
    });
    render(h(LogPanel, { ui }), host);

    const btn = host.querySelector('.log-actions__reply');
    expect(btn).toBeTruthy();

    await act(async () => { btn.click(); });

    expect(replyContextSignal.value).toEqual({
      rootEventId: '$evt1',
      rootSender: '@alice:m',
      rootPreview: 'hello world',
    });
  });

  it('clicking ↪ on a thread reply roots the context at the parent, not the reply', async () => {
    const ui = makeUi({
      activityLog: [
        { icon: '💬', html: 'root', text: 'root msg', ts: '12:00', eventId: '$root', sender: '@alice:m', threadOf: null },
        { icon: '💬', html: 'reply', text: 'reply msg', ts: '12:01', eventId: '$reply', sender: '@bob:m', threadOf: '$root' },
      ],
    });
    render(h(LogPanel, { ui }), host);

    const replyRow = host.querySelector('[data-event-id="$reply"]');
    const btn = replyRow.querySelector('.log-actions__reply');
    expect(btn).toBeTruthy();

    await act(async () => { btn.click(); });

    // Should root at $root, not $reply
    expect(replyContextSignal.value.rootEventId).toBe('$root');
  });

  it('preview is truncated to 60 characters', async () => {
    const longText = 'a'.repeat(80);
    const ui = makeUi({
      activityLog: [
        { icon: '💬', html: 'x', text: longText, ts: '12:00', eventId: '$e', sender: '@a:m', threadOf: null },
      ],
    });
    render(h(LogPanel, { ui }), host);

    const btn = host.querySelector('.log-actions__reply');
    await act(async () => { btn.click(); });

    expect(replyContextSignal.value.rootPreview.length).toBe(60);
  });
});

describe('D4 reply-in-thread - sendChatMessage includes m.relates_to when context is set', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    replyContextSignal.value = null;
    const input = document.createElement('input');
    input.id = 'chat-input';
    document.body.appendChild(input);
  });

  afterEach(() => {
    replyContextSignal.value = null;
  });

  it('outgoing message includes m.relates_to when replyContextSignal is set', async () => {
    replyContextSignal.value = { rootEventId: '$root', rootSender: '@alice:m', rootPreview: 'hello' };
    const ui = makeUi();

    await sendChatMessage(ui, 'Yes indeed');

    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content['m.relates_to']).toEqual({
      rel_type: 'm.thread',
      event_id: '$root',
      is_falling_back: true,
    });
  });

  it('replyContextSignal is cleared to null after a successful send', async () => {
    replyContextSignal.value = { rootEventId: '$root', rootSender: '@alice:m', rootPreview: 'hello' };
    const ui = makeUi();

    await sendChatMessage(ui, 'Yes indeed');

    expect(replyContextSignal.value).toBeNull();
  });

  it('no m.relates_to when replyContextSignal is null', async () => {
    const ui = makeUi();

    await sendChatMessage(ui, 'Plain message');

    const [, content] = ui.widgetManager.sendRoomEvent.mock.calls[0];
    expect(content['m.relates_to']).toBeUndefined();
  });

  it('leaves replyContextSignal intact if send throws', async () => {
    replyContextSignal.value = { rootEventId: '$root', rootSender: '@alice:m', rootPreview: 'hello' };
    const ui = makeUi();
    ui.state.sendRoomEvent = vi.fn().mockRejectedValue(new Error('network fail'));

    await sendChatMessage(ui, 'Message that fails');

    expect(replyContextSignal.value).toEqual({ rootEventId: '$root', rootSender: '@alice:m', rootPreview: 'hello' });
  });
});

describe('D4 reply-in-thread - chip UI in DiceBar', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    replyContextSignal.value = null;
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    replyContextSignal.value = null;
  });

  it('renders no chip when replyContextSignal is null', () => {
    const ui = makeUi();
    render(h(DiceBar, { ui }), host);

    expect(host.querySelector('.reply-context-chip')).toBeFalsy();
  });

  it('renders a chip when replyContextSignal is set', async () => {
    const ui = makeUi();
    render(h(DiceBar, { ui }), host);

    await act(async () => {
      replyContextSignal.value = { rootEventId: '$root', rootSender: '@alice:m', rootPreview: 'hello world' };
    });

    const chip = host.querySelector('.reply-context-chip');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('alice');
    expect(chip.textContent).toContain('hello world');
  });

  it('chip × button clears replyContextSignal', async () => {
    const ui = makeUi();
    render(h(DiceBar, { ui }), host);

    await act(async () => {
      replyContextSignal.value = { rootEventId: '$root', rootSender: '@alice:m', rootPreview: 'hello' };
    });

    const closeBtn = host.querySelector('.reply-context-chip button');
    expect(closeBtn).toBeTruthy();

    await act(async () => { closeBtn.click(); });

    expect(replyContextSignal.value).toBeNull();
  });
});

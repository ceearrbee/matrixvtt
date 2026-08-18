/**
 * OOCPanel - out-of-character side channel.
 *
 * Filtered view of `ui.activityLog` showing only `msgtype: 'm.notice'`
 * entries, with a quick-send input that posts in OOC mode regardless
 * of the current chatModeSignal. Wired as the 'ooc' chat-shell panel.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { OOCPanel } from '../ui/OOCPanel.jsx';
import { chatModeSignal, logVersionSignal } from '../state/ui-signals.js';

function makeUi(activityLog = []) {
  return /** @type {any} */ ({
    activityLog,
    sendChatMessage: vi.fn(),
  });
}

beforeEach(() => {
  chatModeSignal.value = 'say';
  logVersionSignal.value = 0;
});

afterEach(cleanup);

describe('OOCPanel - log filter', () => {
  it('renders only entries with msgtype m.notice', () => {
    const log = [
      { icon: '💬', text: 'IC line', msgtype: 'm.text' },
      { icon: '📢', text: '((OOC)) hi there', msgtype: 'm.notice' },
      { icon: '🎭', text: 'emote', msgtype: 'm.emote' },
      { icon: '📢', text: '((OOC)) brb', msgtype: 'm.notice' },
    ];
    const { container } = render(h(OOCPanel, { ui: makeUi(log) }));
    const items = container.querySelectorAll('[data-ooc-entry]');
    expect(items.length).toBe(2);
    expect(container.textContent).toContain('hi there');
    expect(container.textContent).toContain('brb');
    expect(container.textContent).not.toContain('IC line');
    expect(container.textContent).not.toContain('emote');
  });

  it('shows an empty-state hint when no OOC entries exist', () => {
    const { container } = render(h(OOCPanel, { ui: makeUi([]) }));
    expect(container.querySelector('[data-ooc-empty]')).not.toBeNull();
  });

  it('rerenders when logVersionSignal bumps', async () => {
    const ui = makeUi([]);
    const { container } = render(h(OOCPanel, { ui }));
    expect(container.querySelectorAll('[data-ooc-entry]').length).toBe(0);
    // Simulate a new OOC entry arriving + a log version bump.
    ui.activityLog.push({ icon: '📢', text: 'late ooc', msgtype: 'm.notice' });
    logVersionSignal.value = logVersionSignal.value + 1;
    // wait a tick for signal subscribers
    await Promise.resolve();
    // Re-query (signal subscription rerenders within the same container).
    expect(container.textContent).toContain('late ooc');
  });
});

describe('OOCPanel - quick send', () => {
  it('renders a quick-send input and a send button', () => {
    const { container } = render(h(OOCPanel, { ui: makeUi() }));
    expect(container.querySelector('[data-ooc-input]')).not.toBeNull();
    expect(container.querySelector('[data-ooc-send]')).not.toBeNull();
  });

  it('Send button posts the input value via ui.sendChatMessage', () => {
    const ui = makeUi();
    const { container } = render(h(OOCPanel, { ui }));
    const input = container.querySelector('[data-ooc-input]');
    input.value = 'brb dog';
    fireEvent.click(container.querySelector('[data-ooc-send]'));
    expect(ui.sendChatMessage).toHaveBeenCalledTimes(1);
    expect(ui.sendChatMessage.mock.calls[0][0]).toBe('brb dog');
  });

  it('clears the input after a successful send', () => {
    const ui = makeUi();
    const { container } = render(h(OOCPanel, { ui }));
    const input = container.querySelector('[data-ooc-input]');
    input.value = 'hi';
    fireEvent.click(container.querySelector('[data-ooc-send]'));
    expect(input.value).toBe('');
  });

  it('empty / whitespace-only input does not call sendChatMessage', () => {
    const ui = makeUi();
    const { container } = render(h(OOCPanel, { ui }));
    const input = container.querySelector('[data-ooc-input]');
    input.value = '   ';
    fireEvent.click(container.querySelector('[data-ooc-send]'));
    expect(ui.sendChatMessage).not.toHaveBeenCalled();
  });

  it('Enter in the input sends; Shift+Enter inserts a newline', () => {
    const ui = makeUi();
    const { container } = render(h(OOCPanel, { ui }));
    const input = container.querySelector('[data-ooc-input]');
    input.value = 'one';
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(ui.sendChatMessage).toHaveBeenCalledTimes(1);
    input.value = 'two';
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(ui.sendChatMessage).toHaveBeenCalledTimes(1);
  });

  it('temporarily flips chatModeSignal to ooc for the send, then restores', () => {
    chatModeSignal.value = 'describe';
    const observed = [];
    const ui = {
      activityLog: [],
      sendChatMessage: vi.fn(() => {
        observed.push(chatModeSignal.value);
      }),
    };
    const { container } = render(h(OOCPanel, { ui }));
    const input = container.querySelector('[data-ooc-input]');
    input.value = 'msg';
    fireEvent.click(container.querySelector('[data-ooc-send]'));
    expect(observed).toEqual(['ooc']);          // at the moment of send
    expect(chatModeSignal.value).toBe('describe'); // restored afterwards
  });
});

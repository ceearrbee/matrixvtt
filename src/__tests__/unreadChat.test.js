/**
 * An unread count for chat the player is not looking at.
 *
 * Toast history had an unread badge; the conversation itself had
 * none, so a phone player on the Map pane and a desktop player in
 * another tab both came back with no idea anything had been said.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VTT_EVENTS } from '../utils/constants.js';
import { unreadChatSignal, startUnreadChat } from '../ui/notify/unread-chat.js';
import { resetTabSignal } from '../ui/notify/tab-signal.js';

const BASE = 'MatrixVTT';
let stop = null;

function incoming(body = 'hello') {
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.CHAT_MESSAGE, {
    detail: { sender: '@other:hs', body, msgtype: 'm.text', historical: false },
  }));
}

beforeEach(() => {
  document.title = BASE;
  resetTabSignal();
  document.title = BASE;
  unreadChatSignal.value = 0;
});

afterEach(() => {
  stop?.();
  stop = null;
  resetTabSignal();
});

describe('unread chat count', () => {
  it('counts messages that arrive while chat is out of view', () => {
    stop = startUnreadChat({ isChatVisible: () => false });
    incoming();
    incoming();
    expect(unreadChatSignal.value).toBe(2);
  });

  it('counts nothing while the player is reading chat', () => {
    stop = startUnreadChat({ isChatVisible: () => true });
    incoming();
    expect(unreadChatSignal.value).toBe(0);
  });

  it('ignores backfilled history', () => {
    stop = startUnreadChat({ isChatVisible: () => false });
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.CHAT_MESSAGE, {
      detail: { sender: '@other:hs', body: 'old', msgtype: 'm.text', historical: true },
    }));
    expect(unreadChatSignal.value).toBe(0);
  });

  it('carries the count into the tab title', () => {
    stop = startUnreadChat({ isChatVisible: () => false });
    incoming();
    expect(document.title).toBe(`(1) ${BASE}`);
  });

  it('clears when the player looks at chat again', () => {
    let visible = false;
    stop = startUnreadChat({ isChatVisible: () => visible });
    incoming();
    expect(unreadChatSignal.value).toBe(1);
    visible = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(unreadChatSignal.value).toBe(0);
    expect(document.title).toBe(BASE);
  });

  it('stops counting once disposed', () => {
    stop = startUnreadChat({ isChatVisible: () => false });
    stop();
    stop = null;
    incoming();
    expect(unreadChatSignal.value).toBe(0);
  });
});

describe('the mobile chat tab shows the count', () => {
  it('names the unread count for a screen reader', async () => {
    const { render, screen } = await import('@testing-library/preact');
    const { h } = await import('preact');
    const { MobileTabBar } = await import('../ui/MobileTabBar.jsx');
    const { mobilePaneSignal } = await import('../state/ui-signals.js');
    mobilePaneSignal.value = 'map';
    unreadChatSignal.value = 3;
    render(h(MobileTabBar, { ui: { state: { isGM: () => false } } }));
    expect(screen.getByRole('button', { name: /chat, 3 unread/i })).toBeTruthy();
    unreadChatSignal.value = 0;
  });
});

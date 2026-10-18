/**
 * Nothing MatrixVTT stores in a room is private from that room's
 * members. The shell says so once per room, and says more when the room
 * is public, until the user acknowledges it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { RoomReadableNotice } from '../ui/RoomReadableNotice.jsx';
import { roomAccessSignal } from '../state/signals.js';

function makeUi(roomId = '!r:hs', userId = '@me:hs') {
  return /** @type {any} */ ({ widgetManager: { roomId, userId } });
}

describe('RoomReadableNotice', () => {
  beforeEach(() => {
    localStorage.clear();
    roomAccessSignal.value = { encrypted: false, joinRule: 'invite' };
  });
  afterEach(cleanup);

  it('tells the user everyone in the room can read everything here', () => {
    const { container } = render(h(RoomReadableNotice, { ui: makeUi() }));
    expect(container.textContent).toMatch(/treat this room as public/i);
    expect(container.textContent).toMatch(/whispers/i);
    expect(container.textContent).not.toMatch(/anyone can join/i);
  });

  it('adds that anyone can join and read a public room', () => {
    roomAccessSignal.value = { encrypted: false, joinRule: 'public' };
    const { container } = render(h(RoomReadableNotice, { ui: makeUi() }));
    expect(container.textContent).toMatch(/anyone can join and read/i);
  });

  it('stays gone for this user and room once acknowledged', () => {
    const ui = makeUi();
    const first = render(h(RoomReadableNotice, { ui }));
    fireEvent.click(first.getByRole('button', { name: /got it/i }));
    expect(first.container.querySelector('.room-notice')).toBeNull();
    cleanup();

    expect(render(h(RoomReadableNotice, { ui })).container.querySelector('.room-notice')).toBeNull();
    cleanup();

    expect(render(h(RoomReadableNotice, { ui: makeUi('!other:hs') })).container.querySelector('.room-notice')).not.toBeNull();
    cleanup();
    expect(render(h(RoomReadableNotice, { ui: makeUi('!r:hs', '@else:hs') })).container.querySelector('.room-notice')).not.toBeNull();
  });
});

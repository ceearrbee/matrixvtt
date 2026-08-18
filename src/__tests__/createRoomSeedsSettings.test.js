/**
 * handleCreateRoom must seed a minimal com.vtt.settings state event
 * right after createRoom returns. Without this, newly created rooms
 * don't appear in the "Active Sessions" list - the discovery filter
 * requires non-empty com.vtt.settings - until the setup wizard
 * completes and writes its own settings. Users who created a room
 * but never finished the wizard ended up with orphaned chat-only
 * Matrix rooms that hid from MatrixVTT's discovery screen.
 *
 * The seed is best-effort: if the state write fails (homeserver
 * flake, rate limit), the create flow still proceeds into the
 * setup wizard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateRoom } from '../standalone/session.js';

function makeApp({ createRoomReturns = '!new:m.org' } = {}) {
  const sdk = { sendStateEvent: vi.fn().mockResolvedValue(undefined) };
  const client = {
    createRoom: vi.fn().mockResolvedValue(createRoomReturns),
    sdk,
  };
  const input = document.createElement('input');
  input.id = 'create-room-input';
  input.value = 'My Campaign';
  const btn = document.createElement('button');
  btn.id = 'create-room-btn';
  document.body.appendChild(input);
  document.body.appendChild(btn);
  return /** @type {any} */ ({
    doc: document,
    auth: { client },
    enterRoom: vi.fn().mockResolvedValue(undefined),
    setError: vi.fn(),
    appLog: { add: vi.fn() },
    matrixVTTClient: null,
    showScreen: vi.fn(),
  });
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('handleCreateRoom - seeds com.vtt.settings', () => {
  it('writes a non-empty com.vtt.settings state event right after createRoom', async () => {
    const app = makeApp();
    await handleCreateRoom(app);
    const sendState = app.auth.client.sdk.sendStateEvent;
    expect(sendState).toHaveBeenCalledTimes(1);
    const [roomId, type, content, stateKey] = sendState.mock.calls[0];
    expect(roomId).toBe('!new:m.org');
    expect(type).toBe('com.vtt.settings');
    expect(stateKey).toBe('');
    expect(Object.keys(content).length).toBeGreaterThan(0);
    // The room's display name is preserved so the discovery card
    // and the setup wizard can show it.
    expect(content.name).toBe('My Campaign');
  });

  it('still calls enterRoom even when the seed fails', async () => {
    const app = makeApp();
    app.auth.client.sdk.sendStateEvent.mockRejectedValueOnce(new Error('rate limited'));
    await handleCreateRoom(app);
    expect(app.enterRoom).toHaveBeenCalledTimes(1);
  });

  it('passes forceWizard=true to enterRoom for a fresh room', async () => {
    const app = makeApp();
    await handleCreateRoom(app);
    const [roomId, name, forceWizard] = app.enterRoom.mock.calls[0];
    expect(roomId).toBe('!new:m.org');
    expect(name).toBe('My Campaign');
    expect(forceWizard).toBe(true);
  });
});

function addKnockCheckbox(checked) {
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.id = 'create-room-knock';
  box.checked = checked;
  document.body.appendChild(box);
}

describe('handleCreateRoom - knockable join rule', () => {
  it('passes a knock join rule when the option is checked', async () => {
    const app = makeApp();
    addKnockCheckbox(true);
    await handleCreateRoom(app);
    const [, opts] = app.auth.client.createRoom.mock.calls[0];
    expect(opts?.initialState).toContainEqual({
      type: 'm.room.join_rules', state_key: '', content: { join_rule: 'knock' },
    });
  });

  it('keeps the room invite-only when the option is unchecked', async () => {
    const app = makeApp();
    addKnockCheckbox(false);
    await handleCreateRoom(app);
    const call = app.auth.client.createRoom.mock.calls[0];
    expect(call[1]?.initialState ?? []).toEqual([]);
  });
});

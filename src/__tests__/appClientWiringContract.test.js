/**
 * Wiring contracts that the existing `app-client.test.js` cannot catch
 * because every collaborator there is `vi.doMock`'d to a stub class.
 * That test verifies the *sequence* of constructor and init calls but
 * does NOT verify that real classes still accept the arguments the
 * orchestrator passes. A breaking change to a constructor signature -
 * say, adding a required first argument to `ChatIntegrator` - would
 * pass the mocked test and crash the app at runtime.
 *
 * These tests use the REAL classes wired exactly as `MatrixVTTClient`
 * wires them in `app-client.js#initVTT`, with minimal fakes only at
 * the Matrix-network boundary.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DiceRoller } from '../dice-roller.js';
import { ChatIntegrator } from '../chat-integrator.js';

function makeFakeClientManager() {
  return {
    userId: '@test:example.org',
    roomId: '!room:example.org',
    sendStateEvent: async () => {},
  };
}

function makeFakeState() {
  const sent = [];
  return {
    sent,
    sendRoomEvent: async (type, content) => { sent.push({ type, content }); },
    sendStateEvent: async () => {},
    tokens: new Map(),
    characters: new Map(),
    npcs: new Map(),
  };
}

describe('app-client wiring - real-class contracts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('DiceRoller accepts a state argument and stores it', () => {
    const state = makeFakeState();
    const dice = new DiceRoller(state);
    expect(dice.state).toBe(state);
  });

  it('ChatIntegrator accepts (clientManager, state, diceRoller) and stores refs in that order', () => {
    const cm = makeFakeClientManager();
    const state = makeFakeState();
    const dice = new DiceRoller(state);
    const chat = new ChatIntegrator(cm, state, dice);

    expect(chat.clientManager).toBe(cm);
    expect(chat.state).toBe(state);
    expect(chat.diceRoller).toBe(dice);
  });

  it('ChatIntegrator.init wires the timeline listener and destroy removes it', () => {
    const chat = new ChatIntegrator(makeFakeClientManager(), makeFakeState(), new DiceRoller(makeFakeState()));
    chat.init();
    expect(typeof chat._onTimelineEvent).toBe('function');

    chat.destroy();
    expect(chat._onTimelineEvent).toBeNull();
  });

  it('ChatIntegrator._send routes through state.sendRoomEvent (wiring proof)', async () => {
    const state = makeFakeState();
    const chat = new ChatIntegrator(makeFakeClientManager(), state, new DiceRoller(state));

    await chat._send('hello');

    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].content.body).toBe('hello');
  });

  it('ChatIntegrator loads announcements scoped by clientManager.userId', () => {
    localStorage.setItem(
      'mvtt_announcements:@test:example.org',
      JSON.stringify({ rolls: false }),
    );
    const chat = new ChatIntegrator(makeFakeClientManager(), makeFakeState(), new DiceRoller(makeFakeState()));
    expect(chat.announcements.rolls).toBe(false);
  });
});

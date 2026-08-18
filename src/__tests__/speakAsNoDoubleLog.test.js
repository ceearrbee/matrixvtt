/**
 * speak-as: a single chat send must produce exactly ONE log entry,
 * attributed to the speak-as token (not the speaker's user ID).
 *
 * Bug report: picking "Speak as <Orc Guard>" and submitting once
 * showed BOTH "Orc Guard: rawr" and "crb: rawr" in the log.
 */
import { describe, it, expect, vi } from 'vitest';
import { sendChatMessage } from '../ui/chat-send.js';
import { speakAsSignal } from '../state/ui-signals.js';
import { EVENT_TYPES } from '../utils/constants.js';

function makeUi({ speakAs = '' } = {}) {
  speakAsSignal.value = speakAs;
  const logs = [];
  const ui = {
    state: {
      sendRoomEvent: vi.fn().mockResolvedValue(undefined),
      tokens: new Map([
        ['orc-1', { id: 'orc-1', name: 'Orc Guard', type: 'NPC' }],
      ]),
    },
    widgetManager: { userId: '@crb:matrix.org' },
    mapRenderer: null,
    _log: (icon, html) => logs.push({ icon, html }),
    _findTokenForSender: () => null,
    _installDom() {
      document.body.innerHTML = '<input id="chat-input">';
    },
    logs,
  };
  return ui;
}

describe('speak-as: single send → single log entry', () => {
  it('one log entry attributed to the speak-as token only', async () => {
    const ui = makeUi({ speakAs: 'orc-1' });
    ui._installDom();
    await sendChatMessage(ui, 'rawr');
    expect(ui.logs).toHaveLength(1);
    expect(ui.logs[0].html).toMatch(/Orc Guard/);
    expect(ui.logs[0].html).not.toMatch(/crb/);
  });

  it('no speak-as → one log entry attributed to the user', async () => {
    const ui = makeUi({ speakAs: '' });
    ui._installDom();
    await sendChatMessage(ui, 'rawr');
    expect(ui.logs).toHaveLength(1);
    expect(ui.logs[0].html).toMatch(/crb/);
  });

  it('outgoing Matrix event carries the speak-as token id and prefixes the body so non-VTT clients still see the persona', async () => {
    const ui = makeUi({ speakAs: 'orc-1' });
    ui._installDom();
    await sendChatMessage(ui, 'rawr');
    const [, content] = ui.state.sendRoomEvent.mock.calls[0];
    expect(content[EVENT_TYPES.SPEAK_AS_TOKEN]).toBe('orc-1');
    // The wire body carries the persona prefix so plain Matrix clients
    // see "Orc Guard: rawr"; VTT clients re-render via SPEAK_AS_TOKEN.
    expect(content.body).toBe('Orc Guard: rawr');
  });
});

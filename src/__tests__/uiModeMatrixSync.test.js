/**
 * Matrix sync for the GM's suggested UI mode.
 *
 * `m.vtt.ui_mode` is a GM-only Matrix state event the GM broadcasts
 * when they want the table to follow them into a different UI mode.
 * Players receive it, validate it, and surface a non-blocking banner.
 * The GM's own broadcast is echo-suppressed on the receive path so they
 * don't get banner-spammed by their own selection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EVENT_TYPES, UI_MODES } from '../utils/constants.js';
import { validateStateEvent } from '../utils/schemas.js';
import { broadcastSuggestedMode } from '../state/writers/session-writers.js';
import { handleUiModeStateEvent } from '../state/syncer.js';
import { suggestedModeSignal } from '../state/ui-signals.js';
import { buildCapabilities } from '../widget/capabilities.js';

function makeSm() {
  return {
    settings: {},
    powerLevels: { users: { '@gm:m': 50 } },
    widgetManager: { userId: '@gm:m' },
    sendStateEvent: vi.fn().mockResolvedValue({}),
  };
}

describe('m.vtt.ui_mode constant', () => {
  it('is registered in EVENT_TYPES', () => {
    expect(EVENT_TYPES.UI_MODE).toBe('com.vtt.ui_mode');
  });
});

describe('m.vtt.ui_mode schema validation', () => {
  it('accepts a canonical mode value', () => {
    expect(validateStateEvent(EVENT_TYPES.UI_MODE, { mode: UI_MODES.COMBAT })).toBe(true);
  });

  it('rejects an unknown mode string', () => {
    expect(() => validateStateEvent(EVENT_TYPES.UI_MODE, { mode: 'tactics' }))
      .toThrow(/mode/i);
  });

  it('rejects a missing mode field', () => {
    expect(() => validateStateEvent(EVENT_TYPES.UI_MODE, {})).not.toThrow();
    // Tombstones short-circuit - covered separately. The non-empty case:
    expect(() => validateStateEvent(EVENT_TYPES.UI_MODE, { other: 1 })).toThrow();
  });
});

describe('broadcastSuggestedMode (writer)', () => {
  it('GM publishes the chosen mode through sm.sendStateEvent', async () => {
    const sm = makeSm();
    await broadcastSuggestedMode(sm, UI_MODES.NARRATIVE);
    expect(sm.sendStateEvent).toHaveBeenCalledWith(
      EVENT_TYPES.UI_MODE,
      '',
      { mode: UI_MODES.NARRATIVE },
    );
  });

  it('non-GM is refused - sendStateEvent never fires', async () => {
    const sm = makeSm();
    sm.widgetManager.userId = '@player:m';
    await expect(broadcastSuggestedMode(sm, UI_MODES.COMBAT)).rejects.toThrow();
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });

  it('rejects an unknown mode without writing', async () => {
    const sm = makeSm();
    await expect(broadcastSuggestedMode(sm, 'bogus')).rejects.toThrow();
    expect(sm.sendStateEvent).not.toHaveBeenCalled();
  });
});

describe('handleUiModeStateEvent (syncer)', () => {
  beforeEach(() => { suggestedModeSignal.value = null; });

  it('writes suggestedModeSignal when the event is from another user', () => {
    const sm = makeSm();
    sm.widgetManager.userId = '@player:m';
    handleUiModeStateEvent(sm, {
      type: EVENT_TYPES.UI_MODE,
      sender: '@gm:m',
      content: { mode: UI_MODES.COMBAT },
    });
    expect(suggestedModeSignal.value).toBe(UI_MODES.COMBAT);
  });

  it('echo-suppresses the local user\'s own broadcast', () => {
    const sm = makeSm();
    handleUiModeStateEvent(sm, {
      type: EVENT_TYPES.UI_MODE,
      sender: '@gm:m', // same as widgetManager.userId
      content: { mode: UI_MODES.NARRATIVE },
    });
    expect(suggestedModeSignal.value).toBeNull();
  });

  it('ignores an invalid mode string', () => {
    const sm = makeSm();
    sm.widgetManager.userId = '@player:m';
    handleUiModeStateEvent(sm, {
      type: EVENT_TYPES.UI_MODE,
      sender: '@gm:m',
      content: { mode: 'tactics' },
    });
    expect(suggestedModeSignal.value).toBeNull();
  });

  it('a tombstone clears the suggestion', () => {
    suggestedModeSignal.value = UI_MODES.COMBAT;
    const sm = makeSm();
    sm.widgetManager.userId = '@player:m';
    handleUiModeStateEvent(sm, {
      type: EVENT_TYPES.UI_MODE,
      sender: '@gm:m',
      content: {},
    });
    expect(suggestedModeSignal.value).toBeNull();
  });
});

describe('widget capabilities', () => {
  it('includes receive + send capability for m.vtt.ui_mode', () => {
    const caps = buildCapabilities();
    expect(caps).toContain(`org.matrix.msc2762.receive.state_event:${EVENT_TYPES.UI_MODE}`);
    expect(caps).toContain(`org.matrix.msc2762.send.state_event:${EVENT_TYPES.UI_MODE}`);
  });
});

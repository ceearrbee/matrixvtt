/**
 * settingsOpsCapability.test.js - locks in the narrow-capability pattern
 * demonstrated by SettingsOps (fix.md finding 4).
 *
 * Settings.jsx must accept an `ops` prop and route saves/deletes/ruleset
 * io through it - never by reading methods off `ui` directly. If someone
 * reintroduces the old `ui.exportRuleset()` / `ui.deleteSession()` call
 * sites, this test fails even when the full `ui` stub would paper over it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openSettingsModal } from '../ui/Settings.jsx';
import { withFacade } from './helpers/withFacade.js';

vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('../utils/errorHandling.js', () => ({
  VTTError: class extends Error {},
  ErrorType: { STATE_WRITE: 'STATE_WRITE' },
  showErrorNotification: vi.fn(),
}));
vi.mock('../ui/settings-helpers.js', () => ({
  getCombatSettings: vi.fn(() => ({})),
  setCombatSetting: vi.fn(),
  getAccessibilitySettings: vi.fn(() => ({})),
  setAccessibilitySetting: vi.fn(),
}));

function makeStubUI(isGM = true) {
  const state = withFacade({
    isGM: vi.fn().mockReturnValue(isGM),
    settings: {
      name: 'S', system: 'dnd5e', grid_px: 40,
      gm_user_ids: ['@gm:s'], created_at: 1,
      performance: { enable_chat_announcements: true },
    },
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    constructor: { getGameSystemPresets: () => ({ dnd5e: { meta: { name: 'D&D 5e' } } }) },
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
  return {
    state,
    widgetManager: { roomId: '!r:s', userId: '@gm:s' },
    chat: { announcements: {} },
    _renderApiStatusContent: () => '',
    startTutorial: vi.fn(),
  };
}

describe('Settings modal consumes a narrow ops capability', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('save routes through ops.saveSettings, not ui methods', async () => {
    const ui = makeStubUI(true);
    const ops = {
      saveSettings: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn(),
      exportRuleset: vi.fn(),
      importRuleset: vi.fn(),
    };
    openSettingsModal(ui, ops);

    document.querySelector('#settings-form')
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));

    expect(ops.saveSettings).toHaveBeenCalledTimes(1);
    const arg = ops.saveSettings.mock.calls[0][0];
    expect(arg.settings).toMatchObject({ name: 'S', system: 'dnd5e', grid_px: 40 });
    expect(arg.announcements).toMatchObject({ damage: expect.any(Boolean) });
  });

  it('export/import buttons go through ops, not ui', () => {
    const ui = makeStubUI(true);
    const ops = {
      saveSettings: vi.fn(),
      deleteSession: vi.fn(),
      exportRuleset: vi.fn(),
      importRuleset: vi.fn(),
    };
    openSettingsModal(ui, ops);

    const exportBtn = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Export Ruleset');
    exportBtn.click();
    expect(ops.exportRuleset).toHaveBeenCalledTimes(1);
  });
});

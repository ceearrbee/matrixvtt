/**
 * Settings modal - behavior tests against the Preact `openSettingsModal`
 * entry point in `src/ui/Settings.jsx`. Replaces the legacy tests against
 * the deleted template-string `openSettings` in `settings-panel.js`.
 *
 * GM field visibility, the save-to-Matrix path, and tour restart are
 * still exercised; the DOM the Preact component produces has the same
 * element IDs, so selectors didn't need to change.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EVENT_TYPES } from '../utils/constants.js';
import { openSettingsModal } from '../ui/Settings.jsx';
import { restartOnboardingTour } from '../ui/onboarding-tour.js';
import { layoutModeSignal } from '../state/ui-signals.js';
import { LAYOUT_MODES } from '../utils/constants.js';
import { withFacade } from './helpers/withFacade.js';

vi.mock('../ui/onboarding-tour.js', () => ({ restartOnboardingTour: vi.fn() }));

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

function makeState(isGM = true) {
  return withFacade({
    isGM: vi.fn().mockReturnValue(isGM),
    settings: {
      name: 'Test Session',
      system: 'dnd5e',
      grid_px: 40,
      gm_user_ids: ['@gm:server'],
      created_at: 1000,
      performance: { enable_chat_announcements: true },
    },
    initiative: { active: false, round: 0, current_index: 0, order: [] },
    constructor: {
      getGameSystemPresets: () => ({ dnd5e: { meta: { name: 'D&D 5e' } } }),
    },
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
}

function makeUI(isGM = true) {
  const state = makeState(isGM);
  const widgetManager = {
    userId: isGM ? '@gm:server' : '@player:server',
    roomId: '!room:server',
    canEditRoomState: vi.fn().mockResolvedValue(isGM),
    getRoomPowerLevels: vi.fn().mockResolvedValue({ users: {} }),
  };
  return {
    ui: {
      state,
      widgetManager,
      chat: { setAnnouncementSettings: vi.fn(), announcements: {} },
      _renderApiStatusContent: vi.fn(() => ''),
      _syncDisplayName: vi.fn(),
      _toast: vi.fn(),
      exportRuleset: vi.fn(),
      importRuleset: vi.fn(),
      deleteSession: vi.fn(),
    },
    state,
  };
}

describe('Settings modal (Preact)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Modal content', () => {
    it('shows GM fields to GMs', () => {
      const { ui } = makeUI(true);
      openSettingsModal(ui);

      const modal = document.querySelector('.modal-overlay');
      expect(modal).not.toBeNull();
      expect(modal.querySelector('#settings-name')).not.toBeNull();
      expect(modal.querySelector('#settings-system')).not.toBeNull();
      expect(modal.querySelector('#settings-grid')).not.toBeNull();
      expect(modal.querySelector('#settings-gms')).not.toBeNull();
    });

    it('hides GM-only fields from players', () => {
      const { ui } = makeUI(false);
      openSettingsModal(ui);

      const modal = document.querySelector('.modal-overlay');
      expect(modal).not.toBeNull();
      expect(modal.querySelector('#settings-name')).toBeNull();
      expect(modal.querySelector('#settings-system')).toBeNull();
      expect(modal.querySelector('#settings-grid')).toBeNull();

      // Shared fields still visible to players
      expect(modal.querySelector('#announce-damage')).not.toBeNull();
      expect(modal.querySelector('#settings-room-id')).not.toBeNull();
    });
  });

  describe('Appearance section', () => {
    it('toggles the per-user layout mode from the Appearance tab', () => {
      layoutModeSignal.value = LAYOUT_MODES.TEXT;
      const { ui } = makeUI(false);
      openSettingsModal(ui);
      const tab = [...document.querySelectorAll('[role="tab"]')].find((t) => /appearance/i.test(t.textContent));
      expect(tab).toBeTruthy();
      tab.click();
      const iconChoice = [...document.querySelectorAll('button')].find((b) => /compact icon rail/i.test(b.textContent));
      expect(iconChoice).toBeTruthy();
      iconChoice.click();
      expect(layoutModeSignal.value).toBe(LAYOUT_MODES.ICON);
    });
  });

  describe('Ruleset section', () => {
    it('shows the system browser with the current system marked, and previews it', () => {
      const { ui } = makeUI(true);
      openSettingsModal(ui);
      const tab = [...document.querySelectorAll('[role="tab"]')].find((t) => /ruleset/i.test(t.textContent));
      tab.click();
      const option = document.querySelector('[data-ruleset-option="dnd5e"]');
      expect(option).toBeTruthy();
      expect(option.textContent).toMatch(/current/i);
      expect(document.querySelector('.ruleset-preview__title').textContent).toContain('D&D 5e');
      // The hidden input stays wired for the batched save.
      expect(document.querySelector('#settings-system').value).toBe('dnd5e');
    });
  });

  describe('Tour restart', () => {
    it('offers a restart-tour button that closes the modal and restarts the onboarding tour', () => {
      const { ui } = makeUI(false);
      openSettingsModal(ui);

      const buttons = [...document.querySelectorAll('button')];
      const restartBtn = buttons.find((b) => /restart tour/i.test(b.textContent));
      expect(restartBtn).toBeTruthy();

      restartBtn.click();
      expect(restartOnboardingTour).toHaveBeenCalledWith(ui);
      expect(document.querySelector('.modal-overlay')).toBeNull();
    });
  });

  describe('Saving settings', () => {
    it('routes GM save through ui.state.updateSettings', async () => {
      const { ui, state } = makeUI(true);
      openSettingsModal(ui);
      const form = document.querySelector('#settings-form');
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));

      expect(state.sendStateEvent).toHaveBeenCalledWith(
        EVENT_TYPES.SETTINGS, '', expect.any(Object),
      );
      expect(ui.chat.setAnnouncementSettings).toHaveBeenCalled();
    });

    it('player save updates chat settings but never touches SETTINGS state', async () => {
      const { ui, state } = makeUI(false);
      openSettingsModal(ui);
      const form = document.querySelector('#settings-form');
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));

      expect(state.sendStateEvent).not.toHaveBeenCalled();
      expect(ui.chat.setAnnouncementSettings).toHaveBeenCalled();
    });
  });
});

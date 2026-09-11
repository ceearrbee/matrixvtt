/**
 * Reload-from-server, Restore-from-autosave and Delete Session sat in a
 * footer that rendered on every Settings tab, including Appearance. A
 * destructive action a click away from a theme switch is a footgun;
 * they move into an Advanced disclosure inside About.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openSettingsModal } from '../ui/Settings.jsx';

function makeUi({ isGM = true } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      settings: { name: 'r', system: 'dnd5e', systemConfig: {}, gm_user_ids: ['@me:m'], grid_px: 40 },
      constructor: { getGameSystemPresets: () => ({ dnd5e: { meta: { name: 'D&D 5e' } } }) },
      yjs: { doc: null },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
    chat: { announcements: {} },
    _toast: vi.fn(),
  });
}

const ops = /** @type {any} */ ({ saveSettings: vi.fn(), deleteSession: vi.fn(), exportRuleset: vi.fn(), importRuleset: vi.fn() });

function findButton(re) {
  return [...document.querySelectorAll('button')].find((b) => re.test(b.textContent || ''));
}

describe('Settings destructive actions', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('keeps only Save and Cancel in the always-visible footer', () => {
    openSettingsModal(makeUi(), ops);
    const footer = document.querySelector('.settings-modal .form-actions');
    const labels = [...footer.querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(labels).toEqual(['Cancel', 'Save Settings']);
  });

  it('files them under a collapsed Advanced disclosure', () => {
    openSettingsModal(makeUi(), ops);
    const details = document.querySelector('[data-settings-advanced]');
    expect(details).not.toBeNull();
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.querySelector('summary').textContent).toMatch(/advanced/i);
    for (const re of [/Reload from server/, /Restore from local autosave/, /Delete campaign/]) {
      expect([...details.querySelectorAll('button')].some((b) => re.test(b.textContent)), String(re)).toBe(true);
    }
  });

  it('puts that disclosure inside the About panel, not on every tab', () => {
    openSettingsModal(makeUi(), ops);
    const panel = document.querySelector('#settings-panel-about');
    expect(panel.querySelector('[data-settings-advanced]')).not.toBeNull();
  });

  it('still hides Delete Session from a non-GM', () => {
    openSettingsModal(makeUi({ isGM: false }), ops);
    expect(findButton(/Delete campaign/)).toBeUndefined();
  });
});

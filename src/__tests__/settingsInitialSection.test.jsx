/**
 * openSettingsModal can open at a named section (the sync chip deep-
 * links to About); unknown section keys fall back to the first section.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { openSettingsModal as openSettingsModalReal } from '../ui/Settings.jsx';

const openSettingsModal = /** @type {any} */ (openSettingsModalReal);

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => false,
      settings: { name: 'Room', gm_user_ids: [] },
      roomMembers: [],
    },
    widgetManager: { roomId: '!r:hs', getApi: () => null },
    chat: {},
  });
}

const ops = { saveSettings: vi.fn() };

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
});

describe('openSettingsModal initialSection', () => {
  it('opens at the requested section', () => {
    openSettingsModal(makeUi(), ops, { initialSection: 'about' });
    const tab = document.querySelector('#settings-tab-about');
    expect(tab?.getAttribute('aria-selected')).toBe('true');
    const panel = /** @type {HTMLElement | null} */ (document.querySelector('#settings-panel-about'));
    expect(panel?.hidden).toBe(false);
  });

  it('falls back to the first section for unknown keys', () => {
    openSettingsModal(makeUi(), ops, { initialSection: 'nonsense' });
    const selected = document.querySelector('[role="tab"][aria-selected="true"]');
    expect(selected?.id).toBe('settings-tab-player');
  });
});

/**
 * The header sync chip was a focusable button with no onClick. It now
 * opens Settings at the About section, which hosts the sync status
 * panel, so a degraded chip leads somewhere actionable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { syncOkSignal, queueCountSignal } from '../state/ui-signals.js';

vi.mock('../ui/Settings.jsx', () => ({
  openSettingsModal: vi.fn(),
}));

import { Header } from '../ui/Header.jsx';
import { openSettingsModal } from '../ui/Settings.jsx';

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => false,
      settings: { name: 'Test Room' },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      roomMembers: [],
    },
    widgetManager: {},
  });
}

beforeEach(() => {
  syncOkSignal.value = true;
  queueCountSignal.value = 0;
  document.body.innerHTML = '';
  vi.mocked(openSettingsModal).mockClear();
});

describe('header sync chip', () => {
  it('opens Settings at the About section on click', () => {
    const ui = makeUi();
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(Header, { ui }), root);

    const chip = root.querySelector('[data-sync-status]');
    expect(chip).toBeTruthy();
    chip.click();

    expect(openSettingsModal).toHaveBeenCalledTimes(1);
    const args = vi.mocked(openSettingsModal).mock.calls[0];
    expect(args[0]).toBe(ui);
    expect(args[args.length - 1]).toEqual({ initialSection: 'about' });
  });
});

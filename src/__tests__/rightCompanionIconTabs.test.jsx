/**
 * RightCompanion tabs render icons (not text) under the icon layout mode,
 * while keeping their accessible name via aria-label - so the icon chrome
 * stays screen-reader-navigable.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { RightCompanion } from '../ui/RightCompanion.jsx';
import { settingsSignal, initiativeSignal, charactersSignal, npcsSignal, tokensSignal } from '../state/signals.js';
import { activeTabSignal, selectedCharacterIdSignal, layoutModeSignal } from '../state/ui-signals.js';
import { TABS, LAYOUT_MODES } from '../utils/constants.js';

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      characters: new Map([['pc-1', { id: 'pc-1', name: 'Aria' }]]),
      npcs: new Map(), items: new Map(), tokens: new Map(), spells: new Map(),
      settings: { systemConfig: { spell_schools: [], skills: [] } },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      selectedNPCId: null,
      getCurrentCharacter: () => ({ id: 'pc-1', name: 'Aria' }),
      canEditEntity: () => true, hasTokenForSheet: () => false,
    },
    switchTab: (t) => { activeTabSignal.value = t; },
  });
}

beforeEach(() => {
  settingsSignal.value = { systemConfig: { spell_schools: [], skills: [] } };
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  charactersSignal.value = new Map([['pc-1', { id: 'pc-1', name: 'Aria' }]]);
  npcsSignal.value = new Map();
  tokensSignal.value = new Map();
  selectedCharacterIdSignal.value = 'pc-1';
  activeTabSignal.value = TABS.SHEET;
  layoutModeSignal.value = LAYOUT_MODES.TEXT;
});
afterEach(() => { cleanup(); layoutModeSignal.value = LAYOUT_MODES.TEXT; });

describe('RightCompanion icon tabs', () => {
  it('renders text labels in text mode', () => {
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const party = container.querySelector('#companion-tab-party');
    expect(party.textContent).toContain('Party');
    expect(party.querySelector('svg')).toBeNull();
  });

  it('renders an icon (svg) in icon mode but keeps the accessible name', () => {
    layoutModeSignal.value = LAYOUT_MODES.ICON;
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const party = container.querySelector('#companion-tab-party');
    expect(party.querySelector('svg')).not.toBeNull();
    expect(party.getAttribute('aria-label')).toMatch(/party/i);
  });
});

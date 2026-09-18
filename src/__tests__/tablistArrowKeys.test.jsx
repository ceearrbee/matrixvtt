/**
 * The companion tablist answers the arrow keys, and Escape closes an
 * open drawer.
 *
 * The tabs already carried role="tab", aria-selected, aria-controls
 * and a roving tabindex of 0 on the active tab and -1 on the rest.
 * Only the handler was missing, which is the half that matters: a
 * keyboard user could tab into the strip and then had no way to move
 * along it, because every other tab was deliberately out of the tab
 * order and nothing moved focus between them.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { nextTabIndex } from '../ui/hooks/use-roving-tabindex.js';
import { RightCompanion } from '../ui/RightCompanion.jsx';
import {
  settingsSignal, initiativeSignal, charactersSignal, npcsSignal, tokensSignal,
} from '../state/signals.js';
import {
  activeTabSignal, selectedCharacterIdSignal, selectedNPCIdSignal, tablePhaseSignal,
} from '../state/ui-signals.js';
import { TABS, UI_MODES } from '../utils/constants.js';

const CHARACTER = { id: 'pc-1', name: 'Aria', hp_current: 5, hp_max: 5, ac: 12, speed: 30 };

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true,
      characters: new Map([[CHARACTER.id, CHARACTER]]),
      npcs: new Map(), items: new Map(), tokens: new Map(), spells: new Map(),
      settings: { systemConfig: { spell_schools: [], skills: [] }, environment: {} },
      initiative: { active: false, round: 0, current_index: 0, order: [] },
      damageLog: [], selectedNPCId: null,
      getCurrentCharacter: () => CHARACTER,
      canEditEntity: () => true,
      hasTokenForSheet: () => false,
    },
    _isMyCombatTurn: () => false,
    switchTab: (t) => { activeTabSignal.value = t; },
    widgetManager: { userId: '@a:hs', roomId: '!r:hs' },
  });
}

beforeEach(() => {
  localStorage.clear();
  settingsSignal.value = { systemConfig: { spell_schools: [], skills: [] } };
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  charactersSignal.value = new Map([[CHARACTER.id, CHARACTER]]);
  npcsSignal.value = new Map();
  tokensSignal.value = new Map();
  selectedCharacterIdSignal.value = CHARACTER.id;
  selectedNPCIdSignal.value = null;
  tablePhaseSignal.value = UI_MODES.NARRATIVE;
  activeTabSignal.value = TABS.SHEET;
});
afterEach(() => cleanup());

describe('nextTabIndex', () => {
  it('moves right and left', () => {
    expect(nextTabIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextTabIndex('ArrowLeft', 2, 3)).toBe(1);
  });

  it('wraps at both ends, so the strip has no dead corner', () => {
    expect(nextTabIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('jumps to the ends', () => {
    expect(nextTabIndex('Home', 2, 3)).toBe(0);
    expect(nextTabIndex('End', 0, 3)).toBe(2);
  });

  it('ignores a key that is not navigation', () => {
    expect(nextTabIndex('a', 0, 3)).toBeNull();
    expect(nextTabIndex('Enter', 0, 3)).toBeNull();
  });

  it('does nothing with an empty or single-tab strip', () => {
    expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
    expect(nextTabIndex('ArrowRight', 0, 1)).toBe(0);
  });
});

describe('the companion tablist', () => {
  const tabs = (container) => [...container.querySelectorAll('.ctabs:not(.ctabs--sub) [role="tab"]')];

  it('keeps exactly one tab in the tab order', () => {
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const reachable = tabs(container).filter((t) => t.getAttribute('tabindex') === '0');
    expect(reachable).toHaveLength(1);
  });

  it('moves the selection with ArrowRight', () => {
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const strip = container.querySelector('.ctabs:not(.ctabs--sub)');
    const before = activeTabSignal.value;
    fireEvent.keyDown(strip, { key: 'ArrowRight' });
    expect(activeTabSignal.value).not.toBe(before);
  });

  it('moves focus along with the selection', () => {
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const strip = container.querySelector('.ctabs:not(.ctabs--sub)');
    fireEvent.keyDown(strip, { key: 'ArrowRight' });
    expect(document.activeElement.getAttribute('role')).toBe('tab');
  });

  it('leaves a non-navigation key alone', () => {
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const strip = container.querySelector('.ctabs:not(.ctabs--sub)');
    const before = activeTabSignal.value;
    fireEvent.keyDown(strip, { key: 'x' });
    expect(activeTabSignal.value).toBe(before);
  });
});

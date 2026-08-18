/**
 * RightCompanion - the persistent right-rail tab set for the Almanac shell.
 *
 * Top level stays within working-memory limits: Combat (gated on active
 * initiative) / Sheet / Party / NPCs. Spells, Skills, and Items are sheet
 * content, so they live in a sub-nav inside the Sheet group; the sub-nav
 * renders whenever a sheet-family tab is active, with Spells/Skills gated
 * on the ruleset.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { RightCompanion } from '../ui/RightCompanion.jsx';
import { settingsSignal, initiativeSignal } from '../state/signals.js';
import { activeTabSignal } from '../state/ui-signals.js';
import { TABS } from '../utils/constants.js';

function makeUi(/** @type {any} */ { isGM = false, systemConfig = {}, initiative } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      characters: new Map(),
      npcs: new Map(),
      tokens: new Map(),
      items: new Map(),
      settings: { systemConfig, environment: {} },
      initiative: initiative || { active: false, round: 0, current_index: 0, order: [] },
      damageLog: [],
      getCurrentCharacter: () => null,
    },
    switchTab: (t) => { activeTabSignal.value = t; },
  });
}

const tab = (container, id) => container.querySelector(`.ctab[data-tab="${id}"]`);

beforeEach(() => {
  settingsSignal.value = { systemConfig: {} };
  initiativeSignal.value = { active: false, round: 0, current_index: 0, order: [] };
  activeTabSignal.value = TABS.PARTY;
});
afterEach(() => {
  cleanup();
  activeTabSignal.value = TABS.PARTY;
});

describe('RightCompanion - persistent tab set', () => {
  it('renders the four top-level tabs; Items lives in the Sheet group', () => {
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    expect(tab(container, TABS.SHEET)).not.toBeNull();
    expect(tab(container, TABS.PARTY)).not.toBeNull();
    expect(tab(container, TABS.NPC)).not.toBeNull();
    // Party is active, so the sheet-family sub-nav (and Items) is not mounted.
    expect(tab(container, TABS.ITEMS)).toBeNull();
  });

  it('shows the sheet-family sub-nav when a sheet-family tab is active', () => {
    activeTabSignal.value = TABS.SHEET;
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const sub = container.querySelector('.ctabs--sub');
    expect(sub).not.toBeNull();
    expect(tab(sub, TABS.SHEET)).not.toBeNull();
    expect(tab(sub, TABS.ITEMS)).not.toBeNull();
  });

  it('keeps the top-level Sheet tab selected while a family member is active', () => {
    activeTabSignal.value = TABS.ITEMS;
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const topSheet = container.querySelector('.ctabs:not(.ctabs--sub) .ctab[data-tab="sheet"]');
    expect(topSheet.classList.contains('on')).toBe(true);
    expect(tab(container, TABS.ITEMS).classList.contains('on')).toBe(true);
  });

  it('reports exactly one aria-selected tab while a family member is active', () => {
    activeTabSignal.value = TABS.ITEMS;
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const selected = container.querySelectorAll('.ctab[aria-selected="true"]');
    expect(selected.length).toBe(1);
    expect(selected[0].dataset.tab).toBe(TABS.ITEMS);
    const topSheet = container.querySelector('.ctabs:not(.ctabs--sub) .ctab[data-tab="sheet"]');
    expect(topSheet.classList.contains('on')).toBe(true);
  });

  it('gives the sub-nav row the concrete selection when Sheet itself is active', () => {
    activeTabSignal.value = TABS.SHEET;
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    const selected = container.querySelectorAll('.ctab[aria-selected="true"]');
    expect(selected.length).toBe(1);
    expect(selected[0].id).toBe('companion-subtab-sheet');
  });

  it('hides the Combat tab when initiative is inactive', () => {
    const { container } = render(h(RightCompanion, { ui: makeUi() }));
    expect(tab(container, TABS.COMBAT)).toBeNull();
  });

  it('shows the Combat tab with an order-count badge when initiative is active', () => {
    const initiative = {
      active: true, round: 3, current_index: 0,
      order: [{ token_id: 'a' }, { token_id: 'b' }, { token_id: 'c' }],
    };
    initiativeSignal.value = initiative;
    const { container } = render(h(RightCompanion, { ui: makeUi({ initiative }) }));
    const combat = tab(container, TABS.COMBAT);
    expect(combat).not.toBeNull();
    expect(combat.textContent).toContain('3');
  });

  it('gates Spells and Skills sub-tabs on the ruleset', () => {
    activeTabSignal.value = TABS.SHEET;
    const bare = render(h(RightCompanion, { ui: makeUi() }));
    expect(tab(bare.container, TABS.SPELLS)).toBeNull();
    expect(tab(bare.container, TABS.SKILLS)).toBeNull();
    cleanup();

    const cfg = { spell_schools: ['evocation'], skills: ['stealth'] };
    settingsSignal.value = { systemConfig: cfg };
    activeTabSignal.value = TABS.SHEET;
    const rich = render(h(RightCompanion, { ui: makeUi({ systemConfig: cfg }) }));
    expect(tab(rich.container, TABS.SPELLS)).not.toBeNull();
    expect(tab(rich.container, TABS.SKILLS)).not.toBeNull();
  });

  it('marks the active tab and routes clicks through ui.switchTab', () => {
    const ui = makeUi();
    const { container } = render(h(RightCompanion, { ui }));
    const partyTab = tab(container, TABS.PARTY);
    expect(partyTab.classList.contains('on')).toBe(true);

    fireEvent.click(container.querySelector('.ctabs:not(.ctabs--sub) .ctab[data-tab="sheet"]'));
    expect(activeTabSignal.value).toBe(TABS.SHEET);
  });

  it('routes sub-tab clicks through ui.switchTab', () => {
    activeTabSignal.value = TABS.SHEET;
    const ui = makeUi();
    const { container } = render(h(RightCompanion, { ui }));
    fireEvent.click(tab(container, TABS.ITEMS));
    expect(activeTabSignal.value).toBe(TABS.ITEMS);
  });
});

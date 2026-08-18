import { describe, it, expect } from 'vitest';
import { TABS, UI_MODES, ICON_RAIL_DRAWERS } from '../utils/constants.js';
import {
  phaseEntry, railFor, labelFor, defaultTabFor, defaultDrawerFor,
  initStripIn, isNarrativeLog,
} from '../ui/mode-registry.js';
import { RightCompanion } from '../ui/RightCompanion.jsx';
import { SheetIcon, CombatIcon, WrenchIcon } from '../ui/icons/index.jsx';

describe('mode-registry - intrinsic flags follow PHASE only', () => {
  it('narrative: no strip, narrative log', () => {
    expect(initStripIn(UI_MODES.NARRATIVE)).toBe(false);
    expect(isNarrativeLog(UI_MODES.NARRATIVE)).toBe(true);
  });
  it('combat: strip on, not narrative log', () => {
    expect(initStripIn(UI_MODES.COMBAT)).toBe(true);
    expect(isNarrativeLog(UI_MODES.COMBAT)).toBe(false);
  });
  it('unknown phase falls back to narrative', () => {
    expect(phaseEntry('bogus')).toBe(phaseEntry(UI_MODES.NARRATIVE));
  });
});

describe('mode-registry - right rail is the unified companion', () => {
  it('every phase/prep combination resolves to RightCompanion', () => {
    expect(railFor(UI_MODES.NARRATIVE, false, false)).toBe(RightCompanion);
    expect(railFor(UI_MODES.COMBAT, false, false)).toBe(RightCompanion);
    expect(railFor(UI_MODES.COMBAT, true, false)).toBe(RightCompanion);
    expect(railFor(UI_MODES.NARRATIVE, true, true)).toBe(RightCompanion);
    expect(railFor(UI_MODES.COMBAT, true, true)).toBe(RightCompanion);
    expect(railFor(UI_MODES.NARRATIVE, false, true)).toBe(RightCompanion);
  });
});

describe('mode-registry - label / default tab / drawer', () => {
  it('label still follows the resolved phase/prep (drives the mobile tab)', () => {
    expect(labelFor(UI_MODES.COMBAT, false, false)).toEqual({ label: 'Combat', Icon: CombatIcon });
    expect(labelFor(UI_MODES.NARRATIVE, true, true)).toEqual({ label: 'Prep', Icon: WrenchIcon });
    expect(labelFor(UI_MODES.NARRATIVE, false, false)).toEqual({ label: 'Sheet', Icon: SheetIcon });
  });
  it('defaults: narrative → SHEET/JOURNAL, combat → COMBAT tab, GM prep → PARTY/SCENES', () => {
    expect(defaultTabFor(UI_MODES.NARRATIVE, false, false)).toBe(TABS.SHEET);
    expect(defaultDrawerFor(UI_MODES.NARRATIVE, false, false)).toBe(ICON_RAIL_DRAWERS.JOURNAL);
    expect(defaultTabFor(UI_MODES.COMBAT, false, false)).toBe(TABS.COMBAT);
    expect(defaultTabFor(UI_MODES.NARRATIVE, true, true)).toBe(TABS.PARTY);
    expect(defaultDrawerFor(UI_MODES.NARRATIVE, true, true)).toBe(ICON_RAIL_DRAWERS.SCENES);
  });
  it('non-GM prep flag ignored for defaults', () => {
    expect(defaultTabFor(UI_MODES.NARRATIVE, false, true)).toBe(TABS.SHEET);
  });
});

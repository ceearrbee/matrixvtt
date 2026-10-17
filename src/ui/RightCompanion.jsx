/**
 * RightCompanion.jsx - the Almanac shell's persistent right-rail tab set.
 *
 * Top level stays within working-memory limits: Combat / Sheet / Party /
 * NPCs. Spells, Skills, and Items are sheet content, so they group under
 * the Sheet tab as an in-panel sub-nav that renders while any
 * sheet-family tab is active. The Combat tab is gated on active
 * initiative (it pulses + badges the order count while live);
 * Spells/Skills follow the ruleset. Tab selection still flows through
 * `ui.switchTab` / `activeTabSignal`, so the phase model's
 * `defaultTabFor` + auto-bind effects keep driving which tab shows on a
 * mode change.
 */

import { h } from 'preact';
import { TABS, LAYOUT_MODES } from '../utils/constants.js';
import { settingsSignal, initiativeSignal } from '../state/signals.js';
import {
  activeTabSignal, layoutModeSignal, sheetPanelWidthSignal, companionCollapsedSignal, selectedCharacterIdSignal,
} from '../state/ui-signals.js';

import { CombatTab } from './CombatTab.jsx';
import {
  CombatIcon, SheetIcon, CONCEPT_ICONS, BoxIcon,
} from './icons/index.jsx';
import { CharacterSheet } from './CharacterSheet.jsx';
import { NPCSheet } from './NPCSheet.jsx';
import { Items } from './Items.jsx';
import { Spells } from './Spells.jsx';
import { Skills } from './Skills.jsx';
import { PartyRoster } from './PartyRoster.jsx';
import { usePanelDrag } from './hooks/use-panel-drag.js';
import { onTablistKeyDown } from './hooks/use-roving-tabindex.js';
import {
  clampSheetPanelWidth, writeSheetPanelWidth, DEFAULT_SHEET_WIDTH,
} from '../utils/sheet-panel-size.js';

const TAB_COMPONENTS = {
  [TABS.COMBAT]: CombatTab,
  [TABS.SHEET]: CharacterSheet,
  [TABS.SPELLS]: Spells,
  [TABS.SKILLS]: Skills,
  [TABS.ITEMS]: Items,
  [TABS.PARTY]: PartyRoster,
  [TABS.NPC]: NPCSheet,
};

function CompanionTab({ id, label, title, current, onClick, pulse = false, badge = null, sub = false, selected = null }) {
  const active = id === current;
  return h('button', {
    role: 'tab',
    class: `ctab${active ? ' on' : ''}${pulse ? ' tab--pulse' : ''}`,
    'data-tab': id,
    // A group head stays visually lit (`on`) while a family member is
    // active, but only the actually-selected tab may claim aria-selected.
    'aria-selected': String(selected ?? active),
    'aria-controls': 'companion-content',
    // The Sheet tab renders twice while its family is active (group head
    // + sub-nav), so the sub row needs its own id namespace.
    id: sub ? `companion-subtab-${id}` : `companion-tab-${id}`,
    tabindex: active ? '0' : '-1',
    title,
    'aria-label': `${title} tab${badge != null ? ` (${badge})` : ''}`,
    onClick,
  }, [
    label,
    badge != null && h('span', { class: 'ctab__badge', 'aria-hidden': 'true' }, String(badge)),
  ]);
}

export function resolveFallbackCharacter(ui) {
  if (!ui?.state?.characters || ui.state.characters.size === 0) return null;
  const chars = ui.state.characters;
  const myUserId = ui.widgetManager?.userId;
  // 1. If in combat and current turn is a character
  if (ui.state.initiative?.active && Array.isArray(ui.state.initiative.order)) {
    const cur = ui.state.initiative.order[ui.state.initiative.current_index];
    if (cur) {
      if (cur.entity_id && chars.has(cur.entity_id)) return chars.get(cur.entity_id);
      if (cur.token_id && ui.state.tokens?.has(cur.token_id)) {
        const t = ui.state.tokens.get(cur.token_id);
        if (t?.sheet_id && chars.has(t.sheet_id)) return chars.get(t.sheet_id);
      }
    }
  }
  // 2. Player's claimed character
  if (myUserId) {
    for (const c of chars.values()) {
      if (c && (c.player_user_id === myUserId || c.claimed_by_user_id === myUserId)) return c;
    }
  }
  // 3. First party character
  for (const c of chars.values()) {
    if (c) return c;
  }
  return null;
}

const SHEET_FAMILY = new Set([TABS.SHEET, TABS.SPELLS, TABS.SKILLS, TABS.ITEMS]);

export function RightCompanion({ ui }) {
  // Reading these signals re-renders when the ruleset or initiative change,
  // which is what gates the Spells/Skills/Combat tabs.
  settingsSignal.value; initiativeSignal.value; selectedCharacterIdSignal.value;
  const tab = activeTabSignal.value;
  // In icon layout mode, tabs show an icon instead of a text label. The
  // accessible name is preserved via CompanionTab's title/aria-label.
  const iconMode = layoutModeSignal.value === LAYOUT_MODES.ICON;
  // Icon mode shows a glyph AND the label - bare icons read as ambiguous.
  const lbl = (Icon, text) => (iconMode
    ? [h(Icon, {}), h('span', { class: 'ctab__txt' }, text)]
    : text);

  const select = (t) => () => ui.switchTab(t);
  const combatActive = ui.state.initiative?.active;
  const ruleset = ui.state.settings?.systemConfig;
  const hasSpells = Array.isArray(ruleset?.spell_schools) && ruleset.spell_schools.length > 0;
  const hasSkills = Array.isArray(ruleset?.skills) && ruleset.skills.length > 0;
  const inSheetFamily = SHEET_FAMILY.has(tab);
  const charactersCount = ui?.state?.characters?.size ?? 0;
  let currentCharacter = ui?.state?.getCurrentCharacter?.() || null;
  if (!currentCharacter && inSheetFamily && charactersCount > 0) {
    const fallback = resolveFallbackCharacter(ui);
    if (fallback) {
      currentCharacter = fallback;
      if (typeof ui.selectCharacterById === 'function') {
        ui.selectCharacterById(fallback.id);
      } else {
        selectedCharacterIdSignal.value = fallback.id;
      }
    }
  }
  const showSubTabs = inSheetFamily && charactersCount > 0 && !!currentCharacter;
  // PARTY has no dedicated body distinct from the roster; default a missing
  // mapping to the roster so an unknown stored tab never blanks the panel.
  const TabContent = TAB_COMPONENTS[tab] || PartyRoster;

  const width = sheetPanelWidthSignal.value ?? DEFAULT_SHEET_WIDTH;
  const collapsed = companionCollapsedSignal.value;

  const collapseBtn = h('button', {
    type: 'button',
    class: 'ctab ctab--collapse',
    'aria-label': collapsed ? 'Expand companion panel' : 'Collapse companion panel',
    title: collapsed ? 'Expand panel' : 'Collapse panel',
    onClick: () => { companionCollapsedSignal.value = !companionCollapsedSignal.value; },
  }, collapsed ? '«' : '»');

  if (collapsed) {
    return h('aside', {
      class: 'right-companion right-companion--collapsed',
      role: 'complementary',
      'aria-label': 'Companion',
    }, [
      h('div', { class: 'ctabs ctabs--collapsed', role: 'toolbar', 'aria-label': 'Companion controls' }, [
        collapseBtn,
      ]),
    ]);
  }

  // The signal moves every frame so the panel tracks the pointer; only
  // the commit reaches storage.
  const dragHandlers = usePanelDrag({
    axis: 'x',
    // The handle is on the panel's left edge, so dragging left widens it.
    invert: true,
    startValue: () => width,
    clamp: clampSheetPanelWidth,
    onPreview: (next) => { if (next != null) sheetPanelWidthSignal.value = next; },
    onCommit: (next) => {
      sheetPanelWidthSignal.value = next;
      writeSheetPanelWidth(ui.widgetManager?.userId, ui.widgetManager?.roomId, next);
    },
    dragClass: 'right-companion__resize--dragging',
  });

  return h('aside', {
    class: 'right-companion',
    role: 'complementary',
    'aria-label': 'Companion',
  }, [
    h('div', {
      key: 'resize',
      class: 'right-companion__resize',
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Resize the companion panel',
      'aria-valuenow': String(width),
      tabindex: '0',
      ...dragHandlers,
    }),
    h('div', {
      class: 'ctabs companion-tabs', role: 'tablist', 'aria-label': 'Companion sections',
      onKeyDown: onTablistKeyDown,
    }, [
      combatActive && h(CompanionTab, {
        id: TABS.COMBAT,
        label: [h(CombatIcon, {}), !iconMode && h('span', { class: 'ctab__txt' }, ' Combat')],
        title: 'Combat tracker',
        current: tab, onClick: select(TABS.COMBAT),
        pulse: tab !== TABS.COMBAT,
        badge: ui.state.initiative?.order?.length ?? null,
      }),
      h(CompanionTab, {
        id: TABS.SHEET, label: lbl(SheetIcon, 'Sheet'), title: 'Character sheet',
        // The Sheet tab represents the whole family, so it stays lit
        // while a family member (Spells / Skills / Items) is active.
        // The head is a group opener: it lights up and takes focus for the
        // family, but the concrete selection is always the sub-nav row.
        current: inSheetFamily ? TABS.SHEET : tab,
        selected: false,
        onClick: select(TABS.SHEET),
      }),
      h(CompanionTab, { id: TABS.PARTY, label: lbl(CONCEPT_ICONS.party, 'Party'), title: 'Party roster', current: tab, onClick: select(TABS.PARTY) }),
      h(CompanionTab, { id: TABS.NPC, label: lbl(CONCEPT_ICONS.npc, 'NPCs'), title: 'NPC list', current: tab, onClick: select(TABS.NPC) }),
      collapseBtn,
    ]),
    showSubTabs && h('div', {
      class: 'ctabs ctabs--sub sheet-tabs', role: 'tablist', 'aria-label': 'Sheet sections',
      onKeyDown: onTablistKeyDown,
    }, [
      h(CompanionTab, { id: TABS.SHEET, label: lbl(SheetIcon, 'Overview'), title: 'Character sheet', current: tab, onClick: select(TABS.SHEET), sub: true }),
      hasSpells && h(CompanionTab, { id: TABS.SPELLS, label: lbl(CONCEPT_ICONS.spell, 'Spells'), title: 'Spell list', current: tab, onClick: select(TABS.SPELLS), sub: true }),
      hasSkills && h(CompanionTab, { id: TABS.SKILLS, label: lbl(CONCEPT_ICONS.skill, 'Skills'), title: 'Skill list', current: tab, onClick: select(TABS.SKILLS), sub: true }),
      h(CompanionTab, { id: TABS.ITEMS, label: lbl(BoxIcon, 'Items'), title: 'Item list', current: tab, onClick: select(TABS.ITEMS), sub: true }),
    ]),
    h('div', { class: 'cbody', id: 'companion-content', role: 'tabpanel', tabindex: '0' },
      TabContent ? h(TabContent, { ui, key: tab }) : null),
  ]);
}

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
import { activeTabSignal, layoutModeSignal } from '../state/ui-signals.js';

import { CombatTab } from './CombatTab.jsx';
import {
  CombatIcon, SheetIcon, PeopleIcon, PersonIcon, BookIcon, WrenchIcon, BoxIcon,
} from './icons/index.jsx';
import { CharacterSheet } from './CharacterSheet.jsx';
import { NPCSheet } from './NPCSheet.jsx';
import { Items } from './Items.jsx';
import { Spells } from './Spells.jsx';
import { Skills } from './Skills.jsx';
import { PartyRoster } from './PartyRoster.jsx';

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

const SHEET_FAMILY = new Set([TABS.SHEET, TABS.SPELLS, TABS.SKILLS, TABS.ITEMS]);

export function RightCompanion({ ui }) {
  // Reading these signals re-renders when the ruleset or initiative change,
  // which is what gates the Spells/Skills/Combat tabs.
  settingsSignal.value; initiativeSignal.value;
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
  // PARTY has no dedicated body distinct from the roster; default a missing
  // mapping to the roster so an unknown stored tab never blanks the panel.
  const TabContent = TAB_COMPONENTS[tab] || PartyRoster;

  return h('aside', { class: 'right-companion', role: 'complementary', 'aria-label': 'Companion' }, [
    h('div', { class: 'ctabs', role: 'tablist', 'aria-label': 'Companion sections' }, [
      combatActive && h(CompanionTab, {
        id: TABS.COMBAT, label: h(CombatIcon, {}), title: 'Combat tracker',
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
      h(CompanionTab, { id: TABS.PARTY, label: lbl(PeopleIcon, 'Party'), title: 'Party roster', current: tab, onClick: select(TABS.PARTY) }),
      h(CompanionTab, { id: TABS.NPC, label: lbl(PersonIcon, 'NPCs'), title: 'NPC list', current: tab, onClick: select(TABS.NPC) }),
    ]),
    inSheetFamily && h('div', { class: 'ctabs ctabs--sub', role: 'tablist', 'aria-label': 'Sheet sections' }, [
      h(CompanionTab, { id: TABS.SHEET, label: lbl(SheetIcon, 'Sheet'), title: 'Character sheet', current: tab, onClick: select(TABS.SHEET), sub: true }),
      hasSpells && h(CompanionTab, { id: TABS.SPELLS, label: lbl(BookIcon, 'Spells'), title: 'Spell list', current: tab, onClick: select(TABS.SPELLS), sub: true }),
      hasSkills && h(CompanionTab, { id: TABS.SKILLS, label: lbl(WrenchIcon, 'Skills'), title: 'Skill list', current: tab, onClick: select(TABS.SKILLS), sub: true }),
      h(CompanionTab, { id: TABS.ITEMS, label: lbl(BoxIcon, 'Items'), title: 'Item list', current: tab, onClick: select(TABS.ITEMS), sub: true }),
    ]),
    h('div', { class: 'cbody', id: 'companion-content', role: 'tabpanel', tabindex: '0' },
      TabContent ? h(TabContent, { ui, key: tab }) : null),
  ]);
}

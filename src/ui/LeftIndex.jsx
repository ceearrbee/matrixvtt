/**
 * LeftIndex.jsx - the Almanac shell's left navigation, in one mount.
 *
 * Two variants, one of which renders: the roomy accordion shows every
 * section at once (Scenes / Journal), each collapsible, with a footer
 * menu button carrying the unread badge; `IconRail` is the compact
 * variant that opens one drawer at a time. Both were previously mounted
 * together and switched with `display: none`, so every section body
 * rendered twice and every control existed twice in the tree.
 *
 * Section bodies live in index-sections.js; this module owns the
 * accordion chrome and the variant choice.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { IconRail } from './IconRail.jsx';
import { useMediaQuery } from './hooks/use-media-query.js';
import { layoutModeSignal } from '../state/ui-signals.js';
import { LAYOUT_MODES } from '../utils/constants.js';
import { ICON_RAIL_DRAWERS } from '../utils/constants.js';
import { ScenesDrawer, JournalDrawer } from './index-sections.js';
import { openPopup } from '../state/popup-signals.js';
import {
  notificationHistorySignal, lastSeenTsSignal, unreadCount,
} from '../state/notification-history.js';
import { MenuIcon } from './icons/index.jsx';

// The Maps manager is a modal (GlobalMenu / GM tools), not index
// content, so it holds no section slot here.
// NPCs and Items are managed in the right-rail tabs; the left rail is the
// story/navigation index (scenes + journal) to avoid duplicating them.
const SECTIONS = [
  { key: ICON_RAIL_DRAWERS.SCENES,  label: 'Scenes',  Body: ScenesDrawer,  gmOnly: false, open: true },
  { key: ICON_RAIL_DRAWERS.JOURNAL, label: 'Journal', Body: JournalDrawer, gmOnly: false, open: true },
];

function IndexSection({ section, isOpen, onToggle, ui }) {
  const { key, label, Body } = section;
  return h('div', { class: 'left-index__section', 'data-section': key }, [
    h('button', {
      type: 'button',
      class: 'left-index__section-head',
      'aria-expanded': String(isOpen),
      onClick: onToggle,
    }, [
      h('span', { class: 'left-index__chevron', 'aria-hidden': 'true' }, isOpen ? '▾' : '▸'),
      h('span', { class: 'left-index__section-label' }, label),
    ]),
    isOpen && h('div', { class: 'left-index__section-body' }, h(Body, { ui })),
  ]);
}

// Matches the ≤768px block in styles.css that used to hide the
// accordion; a phone has no room for the always-expanded form.
const COMPACT_QUERY = '(max-width: 768px)';

export function LeftIndex({ ui }) {
  const compactViewport = useMediaQuery(COMPACT_QUERY);
  const iconLayout = layoutModeSignal.value === LAYOUT_MODES.ICON;
  const isGM = typeof ui?.state?.isGM === 'function' ? ui.state.isGM() : false;
  const sections = SECTIONS.filter((s) => !s.gmOnly || isGM);

  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.key, s.open])));
  const toggle = (key) => () =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (compactViewport || iconLayout) return h(IconRail, { ui });

  return h('aside', { class: 'left-index', role: 'navigation', 'aria-label': 'Index' }, [
    h('div', { class: 'left-index__sections' },
      sections.map((s) => h(IndexSection, {
        key: s.key,
        section: s,
        isOpen: !!openSections[s.key],
        onToggle: toggle(s.key),
        ui,
      })),
    ),
    (() => {
      const unread = unreadCount(notificationHistorySignal.value, lastSeenTsSignal.value);
      return h('div', { class: 'left-index__foot' }, [
        h('button', {
          type: 'button',
          class: 'dbt dbt--sm left-index__menu-btn',
          'aria-label': unread ? `Menu, ${unread} unread notifications` : 'Menu',
          onClick: () => openPopup('globalMenu'),
        }, [
          h('span', { 'aria-hidden': 'true' }, [h(MenuIcon, {}), ' Menu']),
          unread > 0 && h('span', { class: 'menu-badge', 'aria-hidden': 'true' }, String(unread)),
        ]),
      ]);
    })(),
  ]);
}

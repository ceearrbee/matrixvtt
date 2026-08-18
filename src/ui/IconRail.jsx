/**
 * IconRail.jsx - left-rail navigation.
 *
 * Replaces the verbose ChannelsRail "file-explorer" feel with a slim
 * icon-only column that expands one of five content drawers on click.
 * Editorial vocabulary: 56px wide collapsed, ~280px drawer, 0.5px
 * borders, restrained typography (matches matrix_vtt_mockup.html).
 *
 *   Menu     - consolidated global menu (actions only)
 *   Scenes   - list of scene-root events; routes the centre column
 *   Journal  - handouts + pages
 *   NPCs     - NPC roster (selects + switches SheetPanel tab)
 *   Items    - item roster (selects + switches SheetPanel tab)
 *   Maps     - GM-only map switcher (existing modal for now)
 *
 * Drawer-open state lives in `openIconRailDrawerSignal`; user clicks
 * also flip `drawerManuallyChosenSignal` so mode-driven defaults stop
 * overriding the user's pick (mirror of the tab-manual pattern).
 */

import { h } from 'preact';
import {
  openIconRailDrawerSignal, drawerManuallyChosenSignal,
} from '../state/ui-signals.js';
import { ICON_RAIL_DRAWERS } from '../utils/constants.js';
import { persistIconRailDrawer } from './ui-mode.js';
import { ScenesDrawer, JournalDrawer } from './index-sections.js';
import { GlobalMenu } from './GlobalMenu.jsx';
import {
  notificationHistorySignal, lastSeenTsSignal, unreadCount,
} from '../state/notification-history.js';
import { SceneIcon, BookIcon, MenuIcon } from './icons/index.jsx';

// NPCs and Items live in the right-rail tabs, not here - the left rail is
// the story/navigation index. The Maps manager is a modal from the menu.
const ICON_DEFS = [
  { key: ICON_RAIL_DRAWERS.SCENES,  Icon: SceneIcon,  label: 'Scenes',  gmOnly: false },
  { key: ICON_RAIL_DRAWERS.JOURNAL, Icon: BookIcon,   label: 'Journal', gmOnly: false },
];

function MenuDrawer({ ui }) {
  // Actions only. The activity/chat feed is the always-present centre
  // chronicle - duplicating it here reads as a confusing second chat
  // log inside the menu. Notifications and the full log stay
  // reachable via the menu's own "Notifications" / "Browse the log" items.
  return h('div', { class: 'icon-rail__menu' }, h(GlobalMenu, { ui }));
}

const DRAWER_COMPONENTS = {
  [ICON_RAIL_DRAWERS.SCENES]:  ScenesDrawer,
  [ICON_RAIL_DRAWERS.JOURNAL]: JournalDrawer,
  [ICON_RAIL_DRAWERS.MENU]:    MenuDrawer,
};

const DRAWER_LABELS = {
  [ICON_RAIL_DRAWERS.SCENES]:  'Scenes',
  [ICON_RAIL_DRAWERS.JOURNAL]: 'Journal',
  [ICON_RAIL_DRAWERS.MENU]:    'Menu',
};

export function IconRail({ ui }) {
  const open = openIconRailDrawerSignal.value;
  const isGM = typeof ui?.state?.isGM === 'function' ? ui.state.isGM() : false;
  const unread = unreadCount(notificationHistorySignal.value, lastSeenTsSignal.value);

  const toggle = (key) => {
    drawerManuallyChosenSignal.value = true;
    const next = open === key ? null : key;
    openIconRailDrawerSignal.value = next;
    persistIconRailDrawer(
      ui?.widgetManager?.userId ?? null,
      ui?.widgetManager?.roomId ?? null,
      next,
    );
  };

  const iconBtn = (entry) => {
    if (entry.gmOnly && !isGM) return null;
    const active = open === entry.key;
    return h('button', {
      key: entry.key,
      type: 'button',
      class: `icon-rail__btn${active ? ' icon-rail__btn--active' : ''}`,
      'data-drawer': entry.key,
      'aria-current': String(active),
      'aria-label': entry.label,
      title: entry.label,
      onClick: () => toggle(entry.key),
    }, [
      h('span', { class: 'icon-rail__glyph', 'aria-hidden': 'true' }, h(entry.Icon, {})),
      h('span', { class: 'icon-rail__label' }, entry.label),
    ]);
  };

  const DrawerComponent = open ? DRAWER_COMPONENTS[open] : null;

  return h('div', { class: 'icon-rail-host' }, [
    h('nav', {
      class: 'icon-rail',
      role: 'navigation',
      'aria-label': 'Workspace',
    }, [
      h('button', {
        type: 'button',
        class: `icon-rail__btn icon-rail__btn--menu${open === ICON_RAIL_DRAWERS.MENU ? ' icon-rail__btn--active' : ''}`,
        'data-drawer': ICON_RAIL_DRAWERS.MENU,
        'aria-current': String(open === ICON_RAIL_DRAWERS.MENU),
        'aria-label': unread ? `Menu, ${unread} unread notifications` : 'Menu',
        title: 'Menu',
        onClick: () => toggle(ICON_RAIL_DRAWERS.MENU),
      }, [
        h('span', { class: 'icon-rail__glyph', 'aria-hidden': 'true' }, h(MenuIcon, {})),
        h('span', { class: 'icon-rail__label' }, 'Menu'),
        unread > 0 && h('span', { class: 'menu-badge', 'aria-hidden': 'true' }, String(unread)),
      ]),
      h('div', { class: 'icon-rail__divider', 'aria-hidden': 'true' }),
      ...ICON_DEFS.map(iconBtn),
    ]),
    DrawerComponent && h('aside', {
      class: 'icon-rail__drawer',
      role: 'complementary',
      'aria-label': DRAWER_LABELS[open] || 'Drawer',
    }, [
      h('div', { class: 'icon-rail__drawer-label' }, DRAWER_LABELS[open]),
      h(DrawerComponent, { ui }),
    ]),
  ]);
}

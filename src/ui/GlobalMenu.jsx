/**
 * GlobalMenu.jsx - the consolidated global-actions menu.
 *
 * Renders the rows from buildGlobalMenuItems as a simple button list.
 * Mounted two ways: as a desktop FloatingPopup (popup name `globalMenu`,
 * via LegacyChatPopups) and inside the mobile IconRail menu drawer. The
 * `onSelect` callback lets the desktop host close the popup after a pick.
 */

import { h } from 'preact';
import { buildGlobalMenuItems } from './global-menu-items.js';

/**
 * @param {{ ui: any, onSelect?: () => void }} props
 */
export function GlobalMenu({ ui, onSelect }) {
  const isGM = typeof ui?.state?.isGM === 'function' ? ui.state.isGM() : false;
  const canLeave = !!ui?.widgetManager?.canLeave;
  const items = buildGlobalMenuItems(ui, { isGM, canLeave });

  return h('div', { class: 'global-menu', role: 'menu' },
    items.map((item) => h('button', {
      key: item.key,
      type: 'button',
      role: 'menuitem',
      class: `global-menu__item dbt dbt--sm${item.danger ? ' dbt--danger' : ''}`,
      'data-menu-item': item.key,
      title: item.title,
      onClick: () => { item.action(); onSelect?.(); },
    }, item.label)),
  );
}

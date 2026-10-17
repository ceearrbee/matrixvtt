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

  // Preserve the order buildGlobalMenuItems returns, but start a new
  // section whenever the group changes, so Leave stays last.
  const sections = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else sections.push({ group: item.group, items: [item] });
  }

  const onKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const container = e.currentTarget;
    const menuItems = Array.from(container.querySelectorAll('button[role="menuitem"]:not([disabled])'));
    if (!menuItems.length) return;
    e.preventDefault();
    const current = document.activeElement;
    const idx = menuItems.indexOf(current);
    let nextIdx = 0;
    if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = menuItems.length - 1;
    } else if (e.key === 'ArrowDown') {
      nextIdx = idx === -1 ? 0 : (idx + 1) % menuItems.length;
    } else if (e.key === 'ArrowUp') {
      nextIdx = idx === -1 ? menuItems.length - 1 : (idx - 1 + menuItems.length) % menuItems.length;
    }
    menuItems[nextIdx]?.focus();
  };

  const seenGroups = new Set();
  return h('div', { class: 'global-menu', role: 'menu', onKeyDown },
    sections.map((section, i) => {
      const showLabel = !seenGroups.has(section.group);
      seenGroups.add(section.group);
      return h('div', {
        key: `${section.group}-${i}`,
        class: `global-menu__group${showLabel ? '' : ' global-menu__group--unlabelled'}`,
        role: 'group',
        'aria-label': section.group,
      }, [
        showLabel && h('div', { class: 'global-menu__group-label', 'aria-hidden': 'true' }, section.group),
        ...section.items.map((item) => h('button', {
          key: item.key,
          type: 'button',
          role: 'menuitem',
          class: `global-menu__item dbt dbt--sm${item.danger ? ' dbt--danger' : ''}`,
          'data-menu-item': item.key,
          title: item.title,
          onClick: () => { item.action(); onSelect?.(); },
        }, item.label)),
      ]);
    }),
  );
}

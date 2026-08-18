/**
 * Right-click context menus for the map.
 *
 * Re-introduced after the Konva phase 6/7 migration deleted the
 * previous builder. Two entry points: `showTokenContextMenu` for a
 * right-click that hits a token, `showMapContextMenu` for a right-click
 * on empty space (GM-only). Each builds a `.context-menu` div appended
 * to `document.body`; a single outside-click / Escape handler closes
 * any open menu.
 */

import { esc } from '../utils/domHelpers.js';

function closeAnyOpenMenu() {
  document.querySelectorAll('.context-menu').forEach((m) => m.remove());
}

function _wireMenu(menu, items) {
  // `items` is the flat actions array (separators excluded). Each menu
  // item carries a `data-action` index into this array.
  const itemEls = [...menu.querySelectorAll('[role="menuitem"]')];
  itemEls.forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(el.getAttribute('data-action'), 10);
      const item = items[idx];
      if (item?.action) item.action();
      closeAnyOpenMenu();
    });
    el.addEventListener('mouseenter', () => el.focus());
  });

  const focusAt = (i) => {
    const target = itemEls[(i + itemEls.length) % itemEls.length];
    target?.focus();
  };
  // Focus first item so the user can immediately drive the menu from
  // the keyboard. Use rAF so the menu paint completes before focus.
  requestAnimationFrame(() => focusAt(0));

  const onMenuKey = (e) => {
    const idx = itemEls.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(idx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(itemEls.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') {
      if (idx >= 0) { e.preventDefault(); itemEls[idx].click(); }
    }
  };
  menu.addEventListener('keydown', onMenuKey);

  // Outside click + Escape close. Attach on the next tick so the
  // contextmenu event that opened us doesn't immediately close us.
  setTimeout(() => {
    const onOutside = (e) => { if (!menu.contains(e.target)) closeAnyOpenMenu(); };
    const onKey = (e) => { if (e.key === 'Escape') closeAnyOpenMenu(); };
    document.addEventListener('mousedown', onOutside, { once: true });
    document.addEventListener('keydown', onKey, { once: true });
  }, 0);
}

function _renderMenu(items) {
  const actions = items.filter((i) => i !== 'separator');
  return items.map((item) => {
    if (item === 'separator') return '<div class="context-menu-separator" role="separator"></div>';
    const idx = actions.indexOf(item);
    const danger = item.danger ? ' context-menu-item--danger' : '';
    return `<div class="context-menu-item${danger}" role="menuitem" tabindex="-1" data-action="${idx}">${esc(item.label)}</div>`;
  }).join('');
}

function _mountMenu({ id, ariaLabel, screenX, screenY, items }) {
  closeAnyOpenMenu();
  if (items.length === 0) return null;
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = id;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', ariaLabel);
  menu.style.left = `${screenX}px`;
  menu.style.top = `${screenY}px`;
  menu.innerHTML = _renderMenu(items);
  document.body.appendChild(menu);
  _wireMenu(menu, items.filter((i) => i !== 'separator'));
  return menu;
}

export function showMapContextMenu(mr, screenX, screenY, col, row) {
  if (!mr.state.isGM?.()) return null;
  const items = [
    { label: '➕ Add Token Here', action: () => mr.showAddTokenDialog?.(col, row) },
    { label: '📌 Add Pin Here', action: () => mr.showPinForm?.(col, row) },
    { label: '🌫️ Toggle Fog Cell', action: () => mr._toggleSingleFogCell?.(col, row) },
    'separator',
    { label: '👁️ Reveal Area', action: () => mr.startAreaSelection?.('reveal') },
    { label: '🌫️ Hide Area', action: () => mr.startAreaSelection?.('hide') },
  ];
  return _mountMenu({
    id: 'map-context-menu', ariaLabel: 'Map actions',
    screenX, screenY, items,
  });
}

export function showPinContextMenu(mr, pin, screenX, screenY) {
  if (!mr.state.isGM?.()) return null;
  const items = [
    { label: '✏️ Edit Pin', action: () => mr.showEditPinForm?.(pin) },
    { label: '🗑️ Remove Pin', danger: true, action: () => mr.removePin?.(pin.id) },
  ];
  return _mountMenu({
    id: 'pin-context-menu', ariaLabel: `Actions for pin "${pin.label || ''}"`,
    screenX, screenY, items,
  });
}

/**
 * Slim token menu (<=7 items). Damage, heal, and conditions live on
 * the token action bar, which appears because opening this menu also
 * selects the token; the menu keeps the less frequent structure and
 * lifecycle actions.
 */
export function showTokenContextMenu(mr, token, screenX, screenY) {
  const tokenData = mr.state.tokens.get(token.id) || token;
  const isGM = !!mr.state.isGM?.();
  const selfId = mr.state.widgetManager?.userId ?? null;
  const isOwner = tokenData?.owner_user_id != null && tokenData.owner_user_id === selfId;
  const isNPC = tokenData?.type === 'npc';

  // Selecting on right-click surfaces the action bar alongside the menu.
  mr.setSelectedToken?.(token.id);

  const items = [];
  const ui = window.ui;

  // Attack: non-owner player on their combat turn.
  if (!isGM && !isOwner && ui?._isMyCombatTurn?.() && mr.state.initiative?.active) {
    items.push({ label: '⚔️ Attack', action: () => ui._showAttackFromTargetModal?.(token.id) });
    items.push('separator');
  }

  items.push({
    label: '📋 View Sheet',
    action: () => {
      window.dispatchEvent(new CustomEvent('vtt:view-sheet', { detail: { tokenId: token.id } }));
    },
  });

  if (isGM || isOwner) {
    const inOrder = mr.state.initiative?.order?.some((e) => e.token_id === token.id);
    items.push(inOrder
      ? { label: '💀 Remove from Initiative', action: () => ui?.removeFromInitiative?.(token.id) }
      : { label: '🎲 Add to Initiative', action: () => ui?.addTokenToInitiative?.(token.id) });
    items.push({ label: '📋 Duplicate Token', action: () => ui?.duplicateToken?.(token.id) });
    items.push(tokenData?.facing != null
      ? { label: '🔄 Clear Facing', action: () => mr._clearFacing?.(token.id) }
      : { label: '🧭 Set Facing', action: () => mr._startFacingMode?.(token.id) });
    items.push('separator');
  }

  if (isGM) {
    if (isNPC) {
      const hpShown = tokenData.show_hp !== false;
      items.push({
        label: hpShown ? '🙈 Hide HP from players' : '👁 Show HP to players',
        action: () => mr.toggleTokenHPVisibility?.(token.id),
      });
    }
    items.push({ label: '🗑️ Remove Token', danger: true, action: () => mr.removeToken?.(token.id) });
  }

  // Drop a trailing separator if the last entry is one (happens when
  // the user is a non-GM non-owner with only View Sheet visible).
  while (items.length && items[items.length - 1] === 'separator') items.pop();

  return _mountMenu({
    id: 'token-context-menu',
    ariaLabel: `Actions for ${tokenData?.name || 'token'}`,
    screenX, screenY, items,
  });
}

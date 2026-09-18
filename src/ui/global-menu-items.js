/**
 * global-menu-items.js - the single source of truth for the global
 * actions menu (opened from the lower-left ☰). Pure: returns an ordered
 * list of { key, group, label, danger?, action } so it can be
 * unit-tested without a DOM. Each action delegates to an existing
 * exported handler; no action logic is duplicated here.
 *
 * `group` renders as a section heading, the way NewEntityMenu already
 * groups. Fifteen flat rows read as a wall; four labelled sections read
 * as a menu.
 *
 * Two rows are deliberately absent. Theme was a blind cycler stepping
 * through five themes with no preview, duplicating the labelled select
 * in Settings > Appearance. Toggle debug bar is a diagnostic and lives
 * in Settings > About with the other diagnostics.
 */

import { VTT_EVENTS } from '../utils/constants.js';
import { openPopup } from '../state/popup-signals.js';
import { showKeyboardHelp } from './keyboard-help.js';
import { showCommandPalette } from './command-palette.js';
import { showFeedbackModal } from './feedback.js';
import { showInvitePlayerModal } from './InvitePlayerModal.jsx';
import { installAvailable, promptInstall } from './pwa/install.js';
import { libraryAvailable, openLibraryBrowser } from './library/open-library.js';
import { docsHref } from '../utils/docs-link.js';

const MENU_GROUPS = Object.freeze({
  TABLE: 'This table',
  CHAT: 'Conversation',
  HELP: 'Help',
});

/** @typedef {{ key: string, group: string, label: string, title?: string, danger?: boolean, action: () => void }} GlobalMenuItem */

/** @returns {GlobalMenuItem[]} */
export function buildGlobalMenuItems(ui, { isGM, canLeave }) {
  /** @type {GlobalMenuItem[]} */
  const items = [
    { key: 'settings', group: MENU_GROUPS.TABLE, label: 'Settings', action: () => ui.openSettings?.() },
  ];
  if (isGM) {
    items.push(
      { key: 'invite', group: MENU_GROUPS.TABLE, label: 'Invite players', action: () => showInvitePlayerModal(ui) },
      { key: 'maps', group: MENU_GROUPS.TABLE, label: 'Maps manager', action: () => ui.openMapsPanel?.() },
    );
  }
  if (installAvailable()) {
    items.push({
      key: 'install', group: MENU_GROUPS.TABLE, label: 'Install as an app',
      title: 'Keep MatrixVTT in your launcher and open it without a browser tab',
      action: () => { void promptInstall(); },
    });
  }
  if (libraryAvailable(ui)) {
    items.push({ key: 'library', group: MENU_GROUPS.TABLE, label: 'Content library', action: () => openLibraryBrowser(ui) });
  }
  items.push(
    { key: 'palette', group: MENU_GROUPS.TABLE, label: 'Search or run a command', action: () => showCommandPalette(ui) },
    { key: 'notifications', group: MENU_GROUPS.CHAT, label: 'Notifications', action: () => openPopup('notifications') },
    { key: 'browse', group: MENU_GROUPS.CHAT, label: 'Browse the log', action: () => openPopup('browse') },
    { key: 'ooc', group: MENU_GROUPS.CHAT, label: 'OOC side panel', action: () => openPopup('ooc') },
    { key: 'keys', group: MENU_GROUPS.HELP, label: 'Keyboard shortcuts', action: () => showKeyboardHelp() },
    {
      key: 'docs',
      group: MENU_GROUPS.HELP,
      label: 'Documentation',
      action: () => (ui.win ?? window).open(docsHref(), '_blank', 'noopener'),
    },
    { key: 'feedback', group: MENU_GROUPS.HELP, label: 'Send feedback', action: () => showFeedbackModal(ui) },
  );
  if (canLeave) {
    items.push({
      key: 'leave',
      group: MENU_GROUPS.TABLE,
      label: 'Leave room',
      danger: true,
      // The confirmation lives in session.leaveRoom, which every
      // LEAVE_ROOM dispatch funnels through - no wrapper dialog here.
      action: () => window.dispatchEvent(new CustomEvent(VTT_EVENTS.LEAVE_ROOM)),
    });
  }
  return items;
}

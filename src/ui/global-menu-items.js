/**
 * global-menu-items.js - the single source of truth for the global
 * actions menu (opened from the lower-left ☰). Pure: returns an ordered
 * list of { key, label, danger?, action } so it can be unit-tested
 * without a DOM. Each action delegates to an existing exported handler;
 * no action logic is duplicated here.
 */

import { VTT_EVENTS } from '../utils/constants.js';
import { openPopup } from '../state/popup-signals.js';
import { themeSignal } from '../state/ui-signals.js';
import { restartOnboardingTour } from './onboarding-tour.js';
import { showKeyboardHelp } from './keyboard-help.js';
import { showFeedbackModal } from './feedback.js';
import { showInvitePlayerModal } from './invite-player.js';
import { confirmLeave } from './destructive-actions.js';
import { libraryAvailable, openLibraryBrowser } from './library/open-library.js';
import { docsHref } from '../utils/docs-link.js';

const THEME_LABELS = {
  auto: 'Auto (system)',
  light: 'Light',
  dark: 'Dark',
  'high-contrast': 'High contrast',
  nondescript: 'Nondescript',
};
// toggleTheme cycles: auto → light → dark → high-contrast → nondescript → auto.
const THEME_NEXT = { auto: 'light', light: 'dark', dark: 'high-contrast', 'high-contrast': 'nondescript', nondescript: 'auto' };

/** @typedef {{ key: string, label: string, title?: string, danger?: boolean, action: () => void }} GlobalMenuItem */

/** @returns {GlobalMenuItem[]} */
export function buildGlobalMenuItems(ui, { isGM, canLeave }) {
  const theme = themeSignal.value;
  const themeLabel = THEME_LABELS[theme] ?? theme;
  const nextLabel = THEME_LABELS[THEME_NEXT[theme]] ?? 'next';
  /** @type {GlobalMenuItem[]} */
  const items = [
    { key: 'notifications', label: 'Notifications', action: () => openPopup('notifications') },
    { key: 'settings', label: 'Settings', action: () => ui.openSettings?.() },
    {
      key: 'theme',
      label: `Theme: ${themeLabel}`,
      title: `Theme: ${themeLabel} - click to switch to ${nextLabel}`,
      action: () => ui.toggleTheme?.(),
    },
  ];
  if (isGM) {
    items.push(
      { key: 'invite', label: 'Invite player', action: () => showInvitePlayerModal(ui) },
      { key: 'maps', label: 'Maps manager', action: () => ui.openMapsPanel?.() },
    );
  }
  if (libraryAvailable(ui)) {
    items.push({ key: 'library', label: 'Content library', action: () => openLibraryBrowser(ui) });
  }
  items.push(
    { key: 'browse', label: 'Browse the log', action: () => openPopup('browse') },
    { key: 'ooc', label: 'OOC side panel', action: () => openPopup('ooc') },
    {
      key: 'chatHelpers',
      label: 'Chat helpers (NPC, whisper)',
      title: 'Speak as an NPC or whisper a player',
      action: () => openPopup('mode'),
    },
    { key: 'tour', label: 'Restart tour', action: () => restartOnboardingTour(ui) },
    {
      key: 'docs',
      label: 'Documentation',
      action: () => (ui.win ?? window).open(docsHref(), '_blank', 'noopener'),
    },
    { key: 'keys', label: 'Keyboard shortcuts', action: () => showKeyboardHelp(ui) },
    { key: 'feedback', label: 'Send feedback', action: () => showFeedbackModal(ui) },
    // _debugMode is a getter-only localStorage view - toggling goes
    // through the controller method, never direct assignment.
    { key: 'debug', label: 'Toggle debug bar', action: () => ui.toggleDebugMode?.() },
  );
  if (canLeave) {
    items.push({
      key: 'leave',
      label: 'Leave room',
      danger: true,
      action: () => confirmLeave(() => window.dispatchEvent(new CustomEvent(VTT_EVENTS.LEAVE_ROOM))),
    });
  }
  return items;
}

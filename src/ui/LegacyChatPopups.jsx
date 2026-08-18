/**
 * LegacyChatPopups.jsx - popup host inside the legacy App.jsx.
 *
 * The chat-first shell rebuild produced a handful of reusable popup
 * bodies (ModePopup / OOCPanel / BrowsePanel) and a FloatingPopup
 * primitive that handles ESC + outside-click close, focus trap, and
 * pin chrome. The pivot is to mount those primitives directly inside
 * the existing legacy shell rather than via a parallel root.
 *
 * This component is a tiny dispatcher: it subscribes to
 * popupsSignal.open and renders a FloatingPopup for every open name,
 * picking the body from a local map. Mounting it as a sibling of
 * .vt-root keeps the popups portaled to <body> (FloatingPopup
 * already does the portal) so stacking is independent of the
 * existing shell.
 *
 * Each chip in Header.jsx flips its name via `togglePopup(name)`.
 * No registry, no docking - the legacy shell already has its own
 * rails (IconRail, RightCompanion) and these popups stay transient.
 */

import { h } from 'preact';
import { popupsSignal, closePopup } from '../state/popup-signals.js';
import { FloatingPopup } from './popups/FloatingPopup.jsx';
import { ModePopup } from './ModePopup.jsx';
import { OOCPanel } from './OOCPanel.jsx';
import { BrowsePanel } from './BrowsePanel.jsx';
import { NotificationLog } from './NotificationLog.jsx';
import { GlobalMenu } from './GlobalMenu.jsx';

/**
 * Local body map. Keys match the names togglePopup uses from the
 * header chips; values describe the popup's title and how to render
 * its body for a given `ui`.
 */
const POPUPS = {
  mode: {
    title: 'Mode',
    size: 'default',
    render: (/* _ui */) => h(ModePopup, {}),
  },
  ooc: {
    title: 'OOC',
    size: 'default',
    render: (ui) => h(OOCPanel, { ui }),
  },
  browse: {
    title: 'Browse',
    size: 'default',
    render: (ui) => h(BrowsePanel, { ui }),
  },
  notifications: {
    title: 'Notifications',
    size: 'default',
    render: (/* _ui */) => h(NotificationLog, {}),
  },
  globalMenu: {
    title: 'Menu',
    size: 'default',
    render: (ui) => h(GlobalMenu, { ui, onSelect: () => closePopup('globalMenu') }),
  },
};

/**
 * @param {{ ui: any }} props
 */
export function LegacyChatPopups({ ui }) {
  const { open } = popupsSignal.value;
  if (!open || open.size === 0) return null;

  const items = [];
  for (const name of open) {
    const spec = POPUPS[name];
    if (!spec) continue;
    items.push(h(FloatingPopup, {
      key: name,
      open: true,
      name,
      title: spec.title,
      size: spec.size,
      onClose: () => closePopup(name),
    }, spec.render(ui)));
  }
  return h('div', { class: 'legacy-chat-popups' }, items);
}


import { h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { settingsSignal, initiativeSignal } from '../state/signals.js';
import { tablePhaseSignal, gmPrepActiveSignal, openIconRailDrawerSignal, mobilePaneSignal, debugModeSignal, layoutModeSignal } from '../state/ui-signals.js';
import { Header } from './Header.jsx';
import { DiceBar } from './DiceBar.jsx';
import { SuggestedModeBanner } from './SuggestedModeBanner.jsx';
import { InitiativeBar } from './InitiativeBar.jsx';
import { MapStrip } from './MapStrip.jsx';
import { LogContainer } from './LogContainer.jsx';
import { IconRail } from './IconRail.jsx';
import { LeftIndex } from './LeftIndex.jsx';
import { CombatInitiativeStrip } from './CombatInitiativeStrip.jsx';
import { initStripIn, railFor } from './mode-registry.js';
import { MobileTabBar } from './MobileTabBar.jsx';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.js';
import { DebugBar } from './sync/DebugBar.jsx';
import { FloatingDocs } from './FloatingDoc.jsx';
import { LegacyChatPopups } from './LegacyChatPopups.jsx';
import { SyncProgress } from './sync/SyncProgress.jsx';

export function App({ ui }) {
  useKeyboardShortcuts(ui);
  const mobilePane = mobilePaneSignal.value;

  // One-shot cleanup: the conversation-first shell retired the
  // per-room layout dichotomy, so any leftover `vtt-layout:*`
  // stamps from older builds are dead weight. Sweep them on mount.
  useEffect(() => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith('vtt-layout:')) localStorage.removeItem(k);
      }
    } catch { /* ETP-blocked storage; ignore */ }
  }, []);

  // Explicit signal dereference at top of render
  // so @preact/signals auto-subscribe binds App to settings and
  // initiative changes. Otherwise initiative starting/ending mid-session
  // wouldn't re-render and the hideInit calculation would stay frozen.
  settingsSignal.value;
  initiativeSignal.value;
  const phase = tablePhaseSignal.value;
  const prepActive = gmPrepActiveSignal.value;
  const isGM = ui.state.isGM();
  const iconRailDrawer = openIconRailDrawerSignal.value;
  const layoutMode = layoutModeSignal.value;

  const hideInit = !ui.state.initiative?.active && !ui.state.isGM();

  const [channelsOpen, setChannelsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Remember the element that opened each drawer so closing returns
  // focus there. Otherwise keyboard / screen-
  // reader users land back on body and have to tab through the chat
  // column to resume.
  const lastFocusRef = useRef(null);

  const toggleDrawer = (key) => {
    if (key === 'channels') {
      setChannelsOpen((v) => {
        if (v) {
          const t = lastFocusRef.current;
          if (t && typeof t.focus === 'function') t.focus();
          lastFocusRef.current = null;
        } else {
          lastFocusRef.current = /** @type {HTMLElement|null} */ (document.activeElement);
        }
        return !v;
      });
    } else {
      setSheetOpen((v) => {
        if (v) {
          const t = lastFocusRef.current;
          if (t && typeof t.focus === 'function') t.focus();
          lastFocusRef.current = null;
        } else {
          lastFocusRef.current = /** @type {HTMLElement|null} */ (document.activeElement);
        }
        return !v;
      });
    }
  };

  const closeDrawers = () => {
    setChannelsOpen(false);
    setSheetOpen(false);
    const t = lastFocusRef.current;
    if (t && typeof t.focus === 'function') t.focus();
    lastFocusRef.current = null;
  };

  return h('div', { class: 'vt-root', 'data-shell': 'conversation' }, [
    debugModeSignal.value ? h(DebugBar, { ui, key: 'dbg' }) : null,
    h(SuggestedModeBanner, { ui, key: 'mode-banner' }),
    h(Header, {
      ui, key: 'hdr',
      channelsOpen, sheetOpen,
      onToggleChannels: () => toggleDrawer('channels'),
      onToggleSheet: () => toggleDrawer('sheet'),
    }),
    h(SyncProgress, { key: 'sync-progress' }),
    h('div', {
      class: 'shell', key: 'main',
      'data-no-init': hideInit ? '' : null,
      'data-channels-open': channelsOpen ? '' : null,
      'data-sheet-open': sheetOpen ? '' : null,
      'data-ui-mode': phase,
      'data-layout': layoutMode,
      'data-mobile-pane': mobilePane,
      'data-icon-rail-open': iconRailDrawer || null,
    }, [
      // Left index: the always-expanded multi-section index on desktop, and
      // the slim one-drawer IconRail on mobile. CSS shows exactly one for
      // the current viewport.
      h('aside', {
        class: 'shell__channels', key: 'channels',
        id: 'shell-channels-drawer',
      }, [
        h(LeftIndex, { ui, key: 'left-index' }),
        h(IconRail, { ui, key: 'icon-rail' }),
      ]),
      h('section', { class: 'shell__chat', key: 'chat' }, [
        // Map region - the "page". The initiative strip overlays the top of
        // the map in Combat; other phases use the older InitiativeBar. The
        // map is resizable via its own drag handle.
        h('div', { class: 'almanac-map', key: 'map-region' }, [
          h(MapStrip, { ui, key: 'map' }),
          initStripIn(phase)
            ? h(CombatInitiativeStrip, { ui, key: 'init-strip' })
            : h(InitiativeBar, { ui, key: 'init' }),
        ]),
        // Chronicle - the chat/system feed with the composer docked at the
        // bottom. Mounted in every phase so conversation is always reachable.
        h('div', { class: 'chronicle', key: 'chronicle' }, [
          h(LogContainer, { ui, key: 'log' }),
          h(DiceBar, { ui, key: 'dice' }),
        ]),
      ]),
      h('aside', {
        class: 'shell__sheet', key: 'sheet',
        id: 'shell-sheet-drawer',
      }, h(railFor(phase, isGM, prepActive), { ui })),
      h('button', {
        key: 'scrim',
        type: 'button',
        class: 'shell__scrim',
        'aria-label': 'Close drawer',
        tabindex: channelsOpen || sheetOpen ? '0' : '-1',
        onClick: closeDrawers,
      }),
      // Bottom tab bar - phone navigation; hidden on desktop via CSS.
      h(MobileTabBar, { ui, key: 'mobile-tabs' }),
      h('div', {
        id: 'vtt-sr-announcements',
        'aria-live': 'polite',
        'aria-atomic': 'true',
        class: 'sr-only',
      }),
      h('div', {
        id: 'vtt-sr-critical',
        'aria-live': 'assertive',
        'aria-atomic': 'true',
        class: 'sr-only',
      }),
    ]),
    h(FloatingDocs, { ui, key: 'floating-docs' }),
    h(LegacyChatPopups, { ui, key: 'legacy-chat-popups' }),
  ]);
}

export function mountApp(container, ui) {
  render(h(App, { ui }), container);
}

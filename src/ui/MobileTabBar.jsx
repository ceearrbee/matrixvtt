/**
 * MobileTabBar.jsx - bottom navigation for the phone layout (≤768px).
 *
 * The desktop three-column shell collapses to a single main area that shows
 * one surface at a time; this bar switches between them by setting
 * `mobilePaneSignal` (mirrored to `data-mobile-pane` on `.shell`, where the
 * mobile CSS does the show/hide). Hidden on desktop via CSS.
 *
 * Four panes map onto the four shell regions:
 *   chat    → the conversation log
 *   map     → the Konva map
 *   panel   → the right rail (Sheet / Combat sidebar / Party, by ui mode)
 *   journal → the left IconRail (channels / scenes / journal / GM)
 *
 * The Panel tab's icon + label track the active mode, mirroring the
 * right-rail content swap (Combat → initiative strip, GM-Prep → PartyRoster).
 */
import { h } from 'preact';
import { tablePhaseSignal, gmPrepActiveSignal, mobilePaneSignal } from '../state/ui-signals.js';
import { labelFor } from './mode-registry.js';
import { ChatIcon, MapsIcon, BookIcon } from './icons/index.jsx';

export function MobileTabBar({ ui }) {
  const active = mobilePaneSignal.value;
  const phase = tablePhaseSignal.value;
  const prep = gmPrepActiveSignal.value;
  const isGM = !!ui?.state?.isGM?.();
  const panel = labelFor(phase, isGM, prep);

  const tabs = /** @type {{ pane: 'chat'|'map'|'panel'|'journal', Icon: any, label: string }[]} */ ([
    { pane: 'chat', Icon: ChatIcon, label: 'Chat' },
    { pane: 'map', Icon: MapsIcon, label: 'Map' },
    { pane: 'panel', Icon: panel.Icon, label: panel.label },
    { pane: 'journal', Icon: BookIcon, label: 'Journal' },
  ]);

  // Honest navigation, not a tablist: each button swaps the whole
  // mobile view, and tab roles would promise arrow-key semantics this
  // bar never had.
  return h('nav', { class: 'mobile-tab-bar', 'aria-label': 'Main views' },
    tabs.map((t) => {
      const isActive = active === t.pane;
      return h('button', {
        key: t.pane,
        type: 'button',
        class: `mobile-tab-bar__tab${isActive ? ' mobile-tab-bar__tab--active' : ''}`,
        ...(isActive ? { 'aria-current': 'page' } : {}),
        'aria-label': t.label,
        onClick: () => { mobilePaneSignal.value = t.pane; },
      }, [
        h('span', { class: 'mobile-tab-bar__icon', 'aria-hidden': 'true' }, t.Icon && h(t.Icon, {})),
        h('span', { class: 'mobile-tab-bar__label' }, t.label),
      ]);
    }),
  );
}

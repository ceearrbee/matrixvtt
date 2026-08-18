/**
 * Header.jsx - top-of-shell banner with three zones:
 *   __left   session title + combat subtitle + mobile channels-drawer toggle
 *   __right  live controls: presence, GM/Prep, chat-tool chips, sync, leave
 *
 * Global utilities (Settings / Theme / Tour / Maps / Feedback / ...) live in
 * the consolidated lower-left menu (GlobalMenu), not here.
 *
 * The table phase (narrative/combat) is not a header control - combat is
 * auto-driven by initiative and layers tools over the always-present
 * map+chat. The subtitle is the single phase status surface; Alt+P toggles
 * the GM prep workspace.
 *
 * Lives as a sibling of `.shell` inside `.vt-root` so the center
 * phase status has room to breathe and the chat column doesn't share
 * vertical space with the title bar. Mobile drawer toggles render here
 * (left and right) instead of in their own row inside the chat column.
 */

import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { VTT_EVENTS, UI_MODES } from '../utils/constants.js';
import { labelFor } from './mode-registry.js';
import { confirmKick, confirmBan, confirmLeave } from './destructive-actions.js';
import { syncOkSignal, tablePhaseSignal, queueCountSignal, gmPrepActiveSignal, layoutModeSignal } from '../state/ui-signals.js';
import { LAYOUT_MODES } from '../utils/constants.js';
import { syncChipText } from './sync-chip.js';
import {
  settingsSignal, initiativeSignal, roomMembersSignal,
} from '../state/signals.js';
import { openGMPanelModal } from './GMTab.jsx';
import { openSettingsModal } from './Settings.jsx';
import { LeaveIcon, MicIcon, KickIcon, BanIcon, PlusIcon, StarIcon, MenuIcon, DotIcon, RefreshIcon, PanelIcon } from './icons/index.jsx';
import { openNewMenu } from './NewEntityMenu.jsx';

function PresenceBadge({ ui, isGM }) {
  const [open, setOpen] = useState(false);
  const members = ui.state.roomMembers || [];
  if (members.length === 0) return null;

  const myUserId = ui.widgetManager?.userId;
  const gmIds = new Set(ui.state.settings?.gm_user_ids || []);
  const inCall = members.filter(m => m.inCall).length;

  const toggle = (e) => {
    if (e.key && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.key) e.preventDefault();
    setOpen(o => !o);
  };

  return h('div', {
    class: 'presence-badge',
    tabindex: 0,
    role: 'button',
    'aria-label': `${members.length} online`,
    'aria-expanded': String(open),
    onClick: toggle,
    onKeyDown: toggle,
  }, [
    h('span', { class: 'presence-dot', 'aria-hidden': 'true' }),
    `${members.length} online`,
    inCall > 0 && h('span', { class: 'presence-badge__call' }, [
      ' · ', h(MicIcon, {}), ` ${inCall}`,
    ]),
    h('div', { class: `presence-popover${open ? ' open' : ''}`, role: 'list' },
      members.map(m => h(MemberRow, { m, isMe: m.userId === myUserId, isGM, gmIds, ui, key: m.userId }))),
  ]);
}

function MemberRow({ m, isMe, isGM, gmIds, ui }) {
  const showActions = isGM && !isMe;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return h('div', { class: 'presence-member' }, [
    h('span', { class: 'presence-member__name' }, [
      gmIds.has(m.userId) ? h(StarIcon, {}) : '',
      m.inCall && h(MicIcon, {}),
      m.inCall ? ' ' : '',
      m.displayname || m.userId,
    ]),
    showActions && h('div', { class: 'presence-member__actions' }, [
      h('button', {
        class: 'dbt dbt--compact',
        title: `Kick ${m.displayname || m.userId} from room`,
        'aria-label': 'Kick user',
        onClick: stop(() => confirmKick(ui, m.userId, m.displayname)),
      }, h(KickIcon, {})),
      h('button', {
        class: 'dbt dbt--compact',
        title: `Ban ${m.displayname || m.userId} from room`,
        'aria-label': 'Ban user',
        style: 'color:var(--color-text-danger)',
        onClick: stop(() => confirmBan(ui, m.userId, m.displayname)),
      }, h(BanIcon, {})),
    ]),
  ]);
}

export function Header({
  ui,
  channelsOpen = false, sheetOpen = false,
  onToggleChannels = null, onToggleSheet = null,
}) {
  settingsSignal.value; initiativeSignal.value; roomMembersSignal.value;
  const phase = tablePhaseSignal.value;
  // Icon layout drops the text labels on the icon-bearing header controls
  // (sync, Leave); their title tooltip + aria-label carry the name.
  const iconMode = layoutModeSignal.value === LAYOUT_MODES.ICON;
  const isGM = !!ui?.state?.isGM?.();
  const sheetToggleLabel = labelFor(phase, isGM, gmPrepActiveSignal.value).label;
  const { name } = ui.state.settings;
  const { active, round, current_index, order } = ui.state.initiative;

  // Single status surface for the table phase (the old center pill
  // duplicated this). Non-possessive actor name so it localizes.
  const subtitle = active && order?.length > 0
    ? `Round ${round} · ${order[current_index]?.name || '-'}`
    : phase === UI_MODES.COMBAT ? 'Combat staged' : 'No combat';

  const leaveRoom = useCallback(
    () => window.dispatchEvent(new CustomEvent(VTT_EVENTS.LEAVE_ROOM)),
    [],
  );

  return h('header', { class: 'vtt-header', role: 'banner' }, [
    h('div', { class: 'vtt-header__left' }, [
      onToggleChannels && h('button', {
        type: 'button',
        class: 'shell__mobile-toggle shell__mobile-toggle--channels',
        'aria-label': channelsOpen ? 'Close channels' : 'Open channels',
        'aria-expanded': String(channelsOpen),
        'aria-controls': 'shell-channels-drawer',
        onClick: onToggleChannels,
      }, h(MenuIcon, {})),
      h('div', { class: 'vtt-header__titles' }, [
        h('h1', { class: 'vtt-header__title' }, name),
        h('span', { class: 'vtt-header__subtitle' }, subtitle),
      ]),
    ]),
    h('div', { class: 'vtt-header__right' }, [
      h(PresenceBadge, { ui, isGM }),
      // GM tools stay in the primary tier (one-click for GMs); the
      // secondary utilities collapse behind the ⋯ overflow.
      isGM && h('button', {
        type: 'button',
        class: 'dbt',
        id: 'gm-controls-btn',
        title: 'GM tools', 'aria-label': 'Open GM tools',
        onClick: () => openGMPanelModal(ui),
      }, 'GM'),
      isGM && h('button', {
        type: 'button',
        class: 'dbt',
        id: 'new-entity-btn',
        title: 'Create new (character, NPC, item, spell, map, scene, handout...)',
        'aria-label': 'Create new',
        onClick: () => openNewMenu(ui),
      }, [
        h(PlusIcon, {}),
        !iconMode && h('span', { class: 'dbt__label' }, ' New'),
      ]),
      (() => {
        // Read .value here so both signals subscribe this component.
        const ok = syncOkSignal.value;
        const queued = queueCountSignal.value;
        const label = syncChipText(ok, queued);
        return h('button', {
          class: `dbt ${ok ? 'dbt--active' : 'dbt--warning'}`,
          'data-sync-status': true,
          title: 'Connection status - click for sync details',
          'aria-label': `Connection status: ${label}. Open sync details.`,
          onClick: () => openSettingsModal(ui, undefined, { initialSection: 'about' }),
        }, [
          h('span', { 'aria-hidden': 'true' }, ok ? h(DotIcon, {}) : h(RefreshIcon, {})),
          !iconMode && h('span', { class: 'dbt__label' }, ` ${label}`),
        ]);
      })(),
      ui.widgetManager?.canLeave && h('button', {
        class: 'dbt dbt--danger',
        id: 'leave-room-btn-header',
        title: 'Leave room',
        'aria-label': 'Leave room',
        onClick: () => confirmLeave(leaveRoom),
      }, [h(LeaveIcon, {}), !iconMode && h('span', { class: 'dbt__label' }, ' Leave')]),
      onToggleSheet && h('button', {
        type: 'button',
        class: 'shell__mobile-toggle shell__mobile-toggle--sheet',
        'aria-label': sheetOpen ? `Close ${sheetToggleLabel.toLowerCase()} panel` : `Open ${sheetToggleLabel.toLowerCase()} panel`,
        'aria-expanded': String(sheetOpen),
        'aria-controls': 'shell-sheet-drawer',
        onClick: onToggleSheet,
      }, [
        // Icon stands in for the label on mobile (CSS hides the word) so the
        // header can't overflow; the accessible name still carries intent.
        h('span', { class: 'shell__mobile-toggle__icon', 'aria-hidden': 'true' }, h(PanelIcon, {})),
        h('span', { class: 'shell__mobile-toggle__label' }, sheetToggleLabel),
      ]),
    ]),
  ]);
}

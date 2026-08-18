/**
 * Settings.jsx - the settings dialog. A section rail (vertical tabs) on
 * the left switches the visible panel on the right; every panel stays
 * mounted (hidden when inactive) so the GM room-settings form keeps its
 * refs across section switches. Rendered into a fresh `.modal-overlay`
 * removed on close. Entry point: {@link openSettingsModal}.
 *
 * Sections: GM / Campaign + Ruleset (GM-only) write room state via
 * `ops.saveSettings`; Player + Appearance + Accessibility are per-user
 * preferences applied immediately (localStorage), not room state.
 */

import { h, render } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { VTT_EVENTS, LAYOUT_MODES } from '../utils/constants.js';
import { CombatAutomationPanel } from './CombatAutomationPanel.jsx';
import { AccessibilityPanel } from './AccessibilityPanel.jsx';
import { ApiStatus } from './sync/ApiStatus.jsx';
import { createSettingsOps } from './capabilities/settings-ops.js';
import { restartOnboardingTour } from './onboarding-tour.js';
import { CampaignSettings, RulesetSettings } from './settings/GMSettings.jsx';
import { SettingsActions } from './settings/SettingsActions.jsx';
import { layoutModeSignal } from '../state/ui-signals.js';
import { yjsDocDiagnostics, formatBytes } from '../state/yjs-diagnostics.js';
import { setLayoutMode } from './ui-mode.js';

const closeModal = (overlay) => overlay.remove();

function LayoutModeControl({ ui }) {
  const current = layoutModeSignal.value;
  const userId = ui.widgetManager?.userId ?? null;
  const opt = (mode, label, hint) => h('button', {
    type: 'button',
    class: `dbt settings-choice${current === mode ? ' settings-choice--on' : ''}`,
    'aria-pressed': String(current === mode),
    onClick: () => setLayoutMode(userId, mode),
  }, [h('span', { class: 'settings-choice__label' }, label), h('span', { class: 'settings-choice__hint' }, hint)]);
  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label' }, 'Layout'),
    h('div', { class: 'settings-choices', role: 'group', 'aria-label': 'Layout mode' }, [
      opt(LAYOUT_MODES.TEXT, 'Text', 'Labeled index & tabs'),
      opt(LAYOUT_MODES.ICON, 'Icon', 'Compact icon rail'),
    ]),
    h('small', { class: 'settings-hint' }, 'Your personal view. Not shared with the table. On phones the icon rail is always used.'),
  ]);
}

function PlayerSettings({ ui, refs }) {
  return h('div', { class: 'settings-section' }, [
    h('h3', { class: 'settings-section__title' }, 'Player'),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Chat Announcements'),
      h('label', { class: 'settings-toggle' }, [
        h('input', { type: 'checkbox', id: 'announce-damage', ref: refs.annDamage, checked: ui.chat?.announcements?.damage !== false }),
        h('span', null, 'Damage & Healing'),
      ]),
      h('label', { class: 'settings-toggle' }, [
        h('input', { type: 'checkbox', id: 'announce-combat', ref: refs.annCombat, checked: ui.chat?.announcements?.combat !== false }),
        h('span', null, 'Combat State Changes'),
      ]),
      h('label', { class: 'settings-toggle' }, [
        h('input', { type: 'checkbox', id: 'announce-map', ref: refs.annMap, checked: ui.chat?.announcements?.mapChanges !== false }),
        h('span', null, 'Map Changes'),
      ]),
      h('small', { class: 'settings-hint' }, 'Which of your actions post a line to the shared chat.'),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Onboarding'),
      h('button', {
        type: 'button', class: 'dbt dbt--sm',
        onClick: () => { refs.overlay.current?.remove?.(); restartOnboardingTour(ui); },
      }, 'Restart tour'),
    ]),
  ]);
}

function AppearanceSettings({ ui }) {
  return h('div', { class: 'settings-section' }, [
    h('h3', { class: 'settings-section__title' }, 'Appearance & Accessibility'),
    h(LayoutModeControl, { ui }),
    h(AccessibilityPanel, { ui }),
  ]);
}

function AboutSection({ ui, isGM }) {
  const docDiag = yjsDocDiagnostics(ui.state?.yjs?.doc);
  return h('div', { class: 'settings-section' }, [
    h('h3', { class: 'settings-section__title' }, 'About'),
    !isGM && h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Game Masters'),
      ui.state.settings.gm_user_ids.length
        ? h('div', { class: 'settings-readonly' }, ui.state.settings.gm_user_ids.map((id) => h('div', null, ['★ ', h('code', null, id)])))
        : h('div', { class: 'settings-readonly' }, 'No GMs assigned'),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Session ID'),
      h('code', { id: 'settings-room-id', class: 'settings-room-id', title: 'Click to select' }, ui.widgetManager.roomId || ''),
      h('small', { class: 'settings-hint' }, 'Share this ID with players so they can join the session.'),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Sync Status'),
      h('div', { id: 'api-status-content', class: 'settings-readonly' }, h(ApiStatus, { ui })),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Collaboration doc'),
      h('div', { class: 'settings-readonly', 'data-yjs-diagnostics': true },
        docDiag
          ? `${formatBytes(docDiag.encodedBytes)} encoded · ${docDiag.totalClock} operations · ${docDiag.clients} client ids`
          : 'Not connected'),
      h('small', { class: 'settings-hint' },
        'The shared campaign document, snapshot to every new joiner. History grows with edits; report a long campaign that reaches megabytes here.'),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Credits'),
      h('p', { class: 'editorial-body', style: 'font-size: 0.9em;' }, [
        'Built-in icons from ',
        h('a', { href: 'https://game-icons.net', target: '_blank', rel: 'noopener' }, 'game-icons.net'),
        ', licensed ',
        h('a', { href: 'https://creativecommons.org/licenses/by/3.0/', target: '_blank', rel: 'noopener' }, 'CC-BY 3.0'),
        '. ',
        h('a', { href: `${import.meta.env.BASE_URL}icons/LICENSE.txt`, target: '_blank', rel: 'noopener' }, 'Full credits.'),
      ]),
    ]),
  ]);
}

function SettingsModal({ ui, ops, overlayRef, initialSection = null }) {
  const isGM = ui.state.isGM();
  const refs = {
    overlay: overlayRef,
    name: useRef(null), system: useRef(null), grid: useRef(null), gridType: useRef(null), gms: useRef(null),
    narrativeMode: useRef(null),
    annDamage: useRef(null), annCombat: useRef(null), annMap: useRef(null),
  };

  const sections = [
    isGM && { key: 'gm', label: 'GM · Campaign', Body: () => h('div', { style: 'display:contents' }, [h(CampaignSettings, { ui, refs }), h(CombatAutomationPanel, null)]) },
    isGM && { key: 'ruleset', label: 'Ruleset', Body: () => h(RulesetSettings, { ui, ops, refs }) },
    { key: 'player', label: 'Player', Body: () => h(PlayerSettings, { ui, refs }) },
    { key: 'appearance', label: 'Appearance', Body: () => h(AppearanceSettings, { ui }) },
    { key: 'about', label: 'About', Body: () => h(AboutSection, { ui, isGM }) },
  ].filter(Boolean);

  const [active, setActive] = useState(
    sections.some((s) => s.key === initialSection) ? initialSection : sections[0].key,
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      let settings;
      if (isGM) {
        const gmUserIds = refs.gms.current.value.split('\n').map((s) => s.trim()).filter(Boolean);
        const selectedSystem = refs.system.current.value;
        const narrativeMode = refs.narrativeMode.current?.value || 'auto';
        settings = {
          name: refs.name.current.value,
          system: selectedSystem,
          systemConfig: ui.state.constructor.getGameSystemPresets()[selectedSystem],
          grid_px: parseInt(refs.grid.current.value),
          grid_type: refs.gridType.current?.value || 'square',
          gm_user_ids: gmUserIds,
          narrative_mode_override: narrativeMode === 'auto' ? undefined : narrativeMode,
        };
      }
      await ops.saveSettings({
        settings,
        announcements: {
          damage: refs.annDamage.current.checked,
          combat: refs.annCombat.current.checked,
          mapChanges: refs.annMap.current.checked,
        },
      });
      closeModal(overlayRef.current);
    } catch (err) {
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.ERROR, { detail: { message: 'Failed to save settings', error: err } }));
    }
  };

  return h('div', {
    class: 'modal-content settings-modal', role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': 'settings-modal-title',
  }, [
    h('div', { class: 'modal-header' }, [
      h('h2', { id: 'settings-modal-title' }, 'Settings'),
      h('button', { class: 'modal-close', 'aria-label': 'Close', onClick: () => closeModal(overlayRef.current) }, '✕'),
    ]),
    h('div', { class: 'modal-body' },
      h('form', { id: 'settings-form', onSubmit }, [
        h('div', { class: 'settings-layout' }, [
          h('div', { class: 'settings-rail', role: 'tablist', 'aria-label': 'Settings sections' },
            sections.map((s) => h('button', {
              key: s.key, type: 'button', role: 'tab',
              id: `settings-tab-${s.key}`,
              class: `settings-rail__item${active === s.key ? ' settings-rail__item--on' : ''}`,
              'aria-selected': String(active === s.key),
              'aria-controls': `settings-panel-${s.key}`,
              tabindex: active === s.key ? '0' : '-1',
              onClick: () => setActive(s.key),
            }, s.label))),
          // All panels stay mounted (hidden when inactive) so the GM
          // room-settings refs survive section switches.
          h('div', { class: 'settings-panel' },
            sections.map((s) => h('div', {
              key: s.key, role: 'tabpanel', id: `settings-panel-${s.key}`,
              'aria-labelledby': `settings-tab-${s.key}`,
              hidden: active !== s.key,
            }, h(s.Body, null)))),
        ]),
        h(SettingsActions, { ui, ops, isGM, overlayRef, closeModal }),
      ])),
  ]);
}

export function openSettingsModal(ui, ops = createSettingsOps(ui), { initialSection = null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);
  const overlayRef = { current: overlay };
  render(h(SettingsModal, { ui, ops, overlayRef, initialSection }), overlay);

  const onEscape = (e) => {
    if (e.key !== 'Escape') return;
    if (!overlay.isConnected) return;
    closeModal(overlay);
    document.removeEventListener('keydown', onEscape, { capture: true });
  };
  document.addEventListener('keydown', onEscape, { capture: true });
}

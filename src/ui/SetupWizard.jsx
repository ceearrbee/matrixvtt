/**
 * SetupWizard.jsx - first-time-setup Preact component. Blank-campaign
 * choice + optional imports + confirm button. The save orchestration
 * is in `./setup/save-flow.js`; this component only collects the
 * user's choice and passes it in.
 */

import { h, render, Fragment } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { VTT_EVENTS } from '../utils/constants.js';
import { confirmTyped } from './confirm-dialogs.jsx';
import { _countResidualEntities } from './setup-tombstone.js';
import { runSetupFlow } from './setup/save-flow.js';
import { maybeAutoStartTour } from './onboarding-tour.js';
import { HelpIcon } from './HelpIcon.jsx';
import { stampRoomVisited } from '../utils/room-visited.js';
import { docsHref } from '../utils/docs-link.js';

const MODAL_ID = 'setup-wizard';

function HelpLink({ slug, label }) {
  const href = docsHref(`formats/${slug}`);
  return h('a', {
    class: 'help-link', href, target: '_blank', rel: 'noopener',
    'aria-label': label, title: label,
  }, '?');
}

function ResidualBanner({ residualCount, onResume }) {
  if (!residualCount) return null;
  return h(Fragment, null, [
    h('div', { class: 'wizard-banner' }, [
      h('strong', null, 'Existing VTT data found:'),
      ` this room already has ${residualCount} entities. Click `,
      h('em', null, 'Resume existing session'),
      ' below to keep them, or pick ',
      h('em', null, 'Blank Campaign'),
      ' to erase and start fresh.',
    ]),
    h('button', {
      type: 'button', class: 'dbt wizard-resume-btn',
      onClick: onResume,
    }, `Resume existing session: keep all ${residualCount} entities`),
  ]);
}

function BlankOptions({ presets, refs }) {
  return h('div', { class: 'wizard-options' }, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'campaign-name' }, 'Campaign Name'),
      h('input', {
        type: 'text', class: 'form-input', id: 'campaign-name',
        placeholder: 'My Epic Campaign',
        ref: refs.name,
      }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'campaign-system' }, [
        'Game System',
        h(HelpIcon, { term: 'ruleset' }),
      ]),
      h('select', { class: 'form-select', id: 'campaign-system', ref: refs.system },
        Object.entries(presets).map(([key, preset]) =>
          h('option', { value: key, selected: key === 'dnd5e' },
            preset.meta?.name ?? preset.name ?? key))),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'API & Performance'),
      h('div', { class: 'wizard-box' }, [
        h('label', { class: 'form-check-row' }, [
          h('input', { type: 'checkbox', id: 'setup-perf-drag', ref: refs.perfDrag, checked: true }),
          h('span', null, 'Sync token position while dragging'),
        ]),
        h('label', { class: 'form-check-row' }, [
          h('input', { type: 'checkbox', id: 'setup-perf-announcements', ref: refs.perfAnnouncements, checked: true }),
          h('span', null, 'Enable automatic chat announcements'),
        ]),
      ]),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Optional: Import existing content'),
      h('div', { class: 'wizard-box wizard-box--imports' }, [
        ImportRow({ label: 'Full campaign archive', hint: '.json, overrides all other options', slug: 'campaign', refKey: refs.campaignFile, accept: '.json,application/json' }),
        ImportRow({ label: 'Custom ruleset', hint: '.vttruleset.json, overrides Game System above', slug: 'ruleset', refKey: refs.rulesetFile, accept: '.json,.vttruleset.json' }),
        ImportRow({ label: 'Characters', hint: '.md exported from MatrixVTT', slug: 'characters', refKey: refs.charsFile, accept: '.md,.markdown,.txt' }),
        ImportRow({ label: 'NPCs', hint: '.md exported from MatrixVTT', slug: 'npcs', refKey: refs.npcsFile, accept: '.md,.markdown,.txt' }),
      ]),
    ]),
  ]);
}

function ImportRow({ label, hint, slug, refKey, accept }) {
  return h('label', { class: 'wizard-import-row' }, [
    h('span', null, [
      label,
      ' ',
      h('small', null, `(${hint})`),
      ' ',
      h(HelpLink, { slug, label: `${label} format help` }),
    ]),
    h('input', { type: 'file', accept, ref: refKey }),
  ]);
}

function SetupWizardBody({ ui, close }) {
  const [busy, setBusy] = useState(false);
  const residualCount = _countResidualEntities(ui);
  const presets = ui.state.constructor.getGameSystemPresets();

  const refs = {
    name: useRef(null), system: useRef(null),
    perfDrag: useRef(null), perfAnnouncements: useRef(null),
    campaignFile: useRef(null), rulesetFile: useRef(null),
    charsFile: useRef(null), npcsFile: useRef(null),
  };

  // Non-destructive exit: close the wizard and proceed with whatever
  // state the room has. Doubles as "Resume existing session" (residual
  // banner) and the always-available "Just open the room" escape hatch.
  const onResume = () => {
    // forceWizard cleared here so subsequent render() won't reopen the wizard.
    ui._forceWizard = false;
    close();
    maybeAutoStartTour({ ui, onAfterTour: () => ui.showPlayerWelcome?.() });
  };

  // Explicit leave - back to the discovery screen. Standalone-only;
  // never wired to ESC/backdrop (leaving the room is too destructive
  // for an accidental keypress).
  const onBack = () => {
    close();
    window.dispatchEvent(new CustomEvent(VTT_EVENTS.LEAVE_ROOM));
  };

  const onConfirm = async () => {
    if (busy) return;

    if (residualCount > 0) {
      const proceed = await new Promise((resolve) => {
        const message = `This room has ${residualCount} live entit${residualCount === 1 ? 'y' : 'ies'} ` +
          `(tokens, characters, items, spells, drawings, walls, templates, pins, pages, lights, maps, …). ` +
          `Loading this campaign will permanently remove ALL of them. ` +
          `If you'd rather keep the existing data, Cancel and choose "Resume existing session".`;
        confirmTyped(
          message,
          'DELETE',
          () => resolve(true),
          { title: 'Wipe room data', confirmText: 'Wipe', confirmClass: 'dbt--danger', onCancel: () => resolve(false) },
        );
      });
      if (!proceed) return;
    }

    setBusy(true);
    /** @type {import('./setup/save-flow.js').WizardChoice} */
    const choice = {
      kind: 'blank',
      campaignName: refs.name.current?.value || 'New Campaign',
      gameSystem: refs.system.current?.value,
      performance: {
        live_token_drag: !!refs.perfDrag.current?.checked,
        enable_chat_announcements: !!refs.perfAnnouncements.current?.checked,
      },
      imports: {
        campaign: refs.campaignFile.current?.files?.[0],
        ruleset: refs.rulesetFile.current?.files?.[0],
        characters: refs.charsFile.current?.files?.[0],
        npcs: refs.npcsFile.current?.files?.[0],
      },
    };
    try {
      await runSetupFlow(ui, choice, close);
    } catch (err) {
      setBusy(false);
      throw err;
    }
  };

  return h('div', {
    class: 'modal-overlay',
    id: MODAL_ID,
    tabIndex: -1,
    onClick: (e) => { if (e.target === e.currentTarget) onResume(); },
    onKeyDown: (e) => { if (e.key === 'Escape') onResume(); },
  },
    h('div', {
      class: 'modal-content', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'setup-wizard-title',
      style: `max-width: ${MODAL_WIDTHS.LARGE};`,
    }, [
      h('div', { class: 'modal-header' }, [
        h('span', { class: 'eyebrow wizard-eyebrow' }, '01 - Start'),
        h('h2', { id: 'setup-wizard-title', class: 'editorial-heading editorial-heading--lg' }, 'MatrixVTT'),
      ]),
      h('div', { class: 'modal-body' }, [
        h(ResidualBanner, { residualCount, onResume }),
        h('p', { class: 'editorial-body wizard-intro' },
          'Open a blank campaign: an empty map, no entities, ready to build from scratch. Everything here is reversible - you can wipe and reseed at any time.'),
        h(BlankOptions, { presets, refs }),
        h('div', { class: 'form-actions wizard-actions' }, [
          ui.widgetManager?.isAppClient && h('button', {
            type: 'button', class: 'dbt',
            'data-wizard-back': '',
            onClick: onBack,
            disabled: busy,
          }, '← Back'),
          h('button', {
            type: 'button', class: 'dbt',
            'data-wizard-open-room': '',
            title: 'Opens the room as-is; this setup screen comes back next visit until a campaign is created.',
            onClick: onResume,
            disabled: busy,
          }, 'Skip setup for now'),
          h('button', {
            type: 'button', class: 'dbt btn-primary',
            onClick: onConfirm,
            disabled: busy,
          }, 'Create Blank Campaign'),
        ]),
        h('p', {
          class: 'wizard-footnote',
        }, 'Skipping opens the room as-is; this setup screen comes back next visit until a campaign is created.'),
      ]),
    ]));
}

// Module-level host reference so `closeSetupWizard()` can tear down a
// mounted wizard from outside this module (e.g. SESSION_RESET in
// lifecycle-init.js) without round-tripping through `getElementById`.
let _wizardHost = null;

export function renderSetupWizard(ui) {
  // Defensive: if a previous wizard mount somehow survived, unmount it
  // before opening a new one. Keeps `_wizardHost` single-instance.
  closeSetupWizard();

  const host = document.createElement('div');
  host.setAttribute('data-vtt-setup-wizard-host', '');
  document.body.appendChild(host);
  _wizardHost = host;

  // Stamp the room as visited the moment the wizard exits - any
  // exit path counts: Resume existing session, Blank campaign, or
  // explicit Cancel. Without this, reloading the page on a freshly-
  // wizard'd room would refire the wizard every time because the
  const close = () => {
    try {
      stampRoomVisited(ui.widgetManager?.userId, ui.widgetManager?.roomId);
    } catch { /* localStorage unavailable; safe to no-op */ }
    closeSetupWizard();
  };
  render(h(SetupWizardBody, { ui, close }), host);
}

export function closeSetupWizard() {
  if (!_wizardHost) return;
  const host = _wizardHost;
  _wizardHost = null;
  render(null, host);
  host.remove();
}

/**
 * SetupWizard.jsx - first-time-setup Preact component. Blank-campaign
 * choice + optional imports + confirm button. The save orchestration
 * is in `./setup/save-flow.js`; this component only collects the
 * user's choice and passes it in.
 */

import { h, Fragment } from 'preact';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { useRef, useState } from 'preact/hooks';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { confirmTyped } from './confirm-dialogs.jsx';
import { _countResidualEntities } from './setup-tombstone.js';
import { runSetupFlow } from './setup/save-flow.js';
import { HelpIcon } from './HelpIcon.jsx';
import { docsHref } from '../utils/docs-link.js';
import { READABLE_ROOM_NOTICE } from '../utils/room-access.js';
import { describeRulesetContent, DEFAULT_RULESET_SLUG } from '../state/rulesets.js';

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
      h('em', null, 'Resume this campaign'),
      ' below to keep them, or pick ',
      h('em', null, 'Blank Campaign'),
      ' to erase and start fresh.',
      h(HelpIcon, { term: 'tombstone', label: 'How deletion works on Matrix' }),
    ]),
    h('button', {
      type: 'button', class: 'dbt wizard-resume-btn',
      onClick: onResume,
    }, `Resume this campaign: keep all ${residualCount} entities`),
  ]);
}

// Room creation already collected the name and the system on the
// standalone create form. Read them back instead of asking twice.
function CampaignSummary({ presets, pending }) {
  const systemName = presets[pending.system]?.meta?.name ?? pending.system;
  return h('p', { class: 'wizard-summary editorial-body' }, [
    h('strong', null, pending.name),
    ` · ${systemName}`,
  ]);
}

function CampaignFields({ presets, refs, system, onSystemChange }) {
  return h(Fragment, null, [
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
      h('select', {
        class: 'form-select', id: 'campaign-system', ref: refs.system,
        value: system,
        onChange: (e) => onSystemChange(e.target.value),
      }, Object.entries(presets).map(([key, preset]) =>
        h('option', { key, value: key }, preset.meta?.name ?? preset.name ?? key))),
      h('p', { id: 'campaign-system-note', class: 'form-hint' },
        describeRulesetContent(system, presets[system])),
    ]),
  ]);
}

function ImportDisclosure({ refs }) {
  return h('details', { class: 'wizard-imports' }, [
    h('summary', null, 'Import existing content'),
    h('div', { class: 'wizard-box wizard-box--imports' }, [
      ImportRow({ label: 'Full campaign archive', hint: '.json, overrides all other options', slug: 'campaign', refKey: refs.campaignFile, accept: '.json,application/json' }),
      ImportRow({ label: 'Custom ruleset', hint: '.vttruleset.json, overrides the game system', slug: 'ruleset', refKey: refs.rulesetFile, accept: '.json,.vttruleset.json' }),
      ImportRow({ label: 'Characters', hint: '.md exported from MatrixVTT', slug: 'characters', refKey: refs.charsFile, accept: '.md,.markdown,.txt' }),
      ImportRow({ label: 'NPCs', hint: '.md exported from MatrixVTT', slug: 'npcs', refKey: refs.npcsFile, accept: '.md,.markdown,.txt' }),
    ]),
  ]);
}

function BlankOptions({ presets, refs, pending, system, onSystemChange }) {
  return h('div', { class: 'wizard-options' }, [
    pending
      ? h(CampaignSummary, { presets, pending })
      : h(CampaignFields, { presets, refs, system, onSystemChange }),
    h(ImportDisclosure, { refs }),
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
  const pending = ui._pendingCampaign ?? null;
  const [system, setSystem] = useState(pending?.system ?? DEFAULT_RULESET_SLUG);
  const residualCount = _countResidualEntities(ui);
  const presets = ui.state.constructor.getGameSystemPresets();

  const refs = {
    name: useRef(null),
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
  };

  const onConfirm = async () => {
    if (busy) return;

    if (residualCount > 0) {
      const proceed = await new Promise((resolve) => {
        const message = `This room has ${residualCount} live entit${residualCount === 1 ? 'y' : 'ies'} ` +
          `(tokens, characters, items, spells, drawings, walls, templates, pins, pages, lights, maps, …). ` +
          `Loading this campaign will permanently remove ALL of them. ` +
          `If you'd rather keep the existing data, Cancel and choose "Resume this campaign".`;
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
      campaignName: pending?.name || refs.name.current?.value || 'New Campaign',
      gameSystem: system,
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

  return h(Modal, {
    id: MODAL_ID,
    title: 'Create your campaign',
    eyebrow: 'MatrixVTT',
    maxWidth: MODAL_WIDTHS.LARGE,
    // Dismissing is "open the room as-is", never "leave the room".
    onClose: onResume,
  }, [
    h(ResidualBanner, { residualCount, onResume }),
    h('p', { class: 'editorial-body wizard-intro' }, [
      'An empty map and no entities, ready to build from scratch. Everything here is reversible - you can wipe and reseed at any time. ',
      h('a', {
        class: 'help-link help-link--inline',
        href: docsHref('guide/gm-quickstart'),
        target: '_blank', rel: 'noopener',
      }, 'Read the GM quickstart'),
    ]),
    h('p', { class: 'form-hint wizard-readable' }, READABLE_ROOM_NOTICE),
    h(BlankOptions, { presets, refs, pending, system, onSystemChange: setSystem }),
    h('div', { class: 'form-actions wizard-actions' }, [
      h('button', {
        type: 'button', class: 'standalone-link-btn',
        'data-wizard-open-room': '',
        onClick: onResume,
        disabled: busy,
      }, 'Skip for now - the room stays plain chat, and Next steps offers setup later'),
      h('button', {
        type: 'button', class: 'dbt btn-primary',
        onClick: onConfirm,
        disabled: busy,
      }, 'Create campaign'),
    ]),
  ]);
}

// Module-level disposer so `closeSetupWizard()` can tear down a mounted
// wizard from outside this module (e.g. SESSION_RESET in
// lifecycle-init.js).
let _disposeWizard = null;

export function renderSetupWizard(ui) {
  // Defensive: if a previous wizard mount somehow survived, unmount it
  // before opening a new one.
  closeSetupWizard();

  _disposeWizard = openModal((dispose) => {
    const close = () => {
      dispose();
      _disposeWizard = null;
    };
    return h(SetupWizardBody, { ui, close });
  });
}

export function closeSetupWizard() {
  const dispose = _disposeWizard;
  _disposeWizard = null;
  dispose?.();
}

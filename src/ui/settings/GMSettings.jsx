/**
 * GM-only settings, split into two section bodies for the settings rail:
 *   - CampaignSettings: session name, GM roster, grid defaults, narrative
 *     mode, and full-campaign backup/restore.
 *   - RulesetSettings: game system + ruleset import/export/validate/library.
 * Both are mounted only when `state.isGM()` is true (the rail hides the GM
 * and Ruleset sections for players).
 */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { openRulesetValidator } from '../RulesetValidator.jsx';
import { SaveToLibraryButton } from '../library/SaveToLibraryButton.jsx';
import { rulesetFacts } from '../library/preview-facts.js';
import { RulesetDetail } from './RulesetDetail.jsx';
import { LIBRARY_KIND } from '../../utils/constants.js';

export function CampaignSettings({ ui, refs }) {
  return h('div', { class: 'settings-section' }, [
    h('h3', { class: 'settings-section__title' }, 'Campaign'),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'settings-name' }, ['Session Name ', h('span', { 'aria-hidden': 'true' }, '*')]),
      h('input', { type: 'text', class: 'form-input', id: 'settings-name', value: ui.state.settings.name, required: true, 'aria-required': 'true', ref: refs.name }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'settings-gms' }, 'GM User IDs'),
      h('textarea', { class: 'form-textarea', id: 'settings-gms', rows: 3, ref: refs.gms }, ui.state.settings.gm_user_ids.join('\n')),
      h('small', { class: 'settings-hint' }, 'One Matrix ID per line. GMs can edit room state and see hidden content.'),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'settings-grid' }, 'Default Grid Size (pixels)'),
      h('input', { type: 'number', class: 'form-input', id: 'settings-grid', value: ui.state.settings.grid_px, min: 20, max: 100, ref: refs.grid }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'settings-grid-type' }, 'Grid Type'),
      h('select', { class: 'form-select', id: 'settings-grid-type', ref: refs.gridType, value: ui.state.settings.grid_type || 'square' }, [
        h('option', { value: 'square' }, 'Square'),
        h('option', { value: 'hex_pointy' }, 'Hex (pointy-top)'),
        h('option', { value: 'hex_flat' }, 'Hex (flat-top)'),
      ]),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'settings-narrative-mode' }, 'Narrative Mode'),
      h('select', { class: 'form-select', id: 'settings-narrative-mode', ref: refs.narrativeMode, value: ui.state.settings.narrative_mode_override || 'auto' }, [
        h('option', { value: 'auto' }, 'Auto (follow ruleset)'),
        h('option', { value: 'on' }, 'Force on'),
        h('option', { value: 'off' }, 'Force off'),
      ]),
      h('small', { class: 'settings-hint' },
        'Narrative rooms default the channels rail to the most recent Scene instead of Live chat. Auto follows the ruleset (FATE / PbtA / WoD / OpenD6 are narrative by default).'),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Backup & Restore (Full Campaign)'),
      h('div', { class: 'settings-btn-row' }, [
        h('button', { type: 'button', class: 'dbt dbt--sm', onClick: () => ui.exportState() }, 'Export Campaign JSON'),
        h('label', { class: 'dbt dbt--sm settings-file-btn' }, [
          'Import Campaign JSON',
          h('input', {
            type: 'file', accept: '.json', style: 'display: none;',
            onChange: (e) => { const f = e.target.files?.[0]; if (f) { refs.overlay.current?.remove?.(); ui.importCampaign(f); } },
          }),
        ]),
      ]),
      h('small', { class: 'settings-hint' },
        'Port your entire session (maps, tokens, characters, settings) to another room or save a point-in-time backup.'),
    ]),
  ]);
}

function presetFacts(key, preset) {
  return rulesetFacts({
    system: key,
    version: preset.meta?.version,
    author: preset.meta?.author,
    license: preset.meta?.license,
    attributes: preset.attributes,
    skills: preset.skills,
    conditions: preset.conditions,
    saves: preset.saves,
    damage_types: preset.damage_types,
    item_kinds: preset.item_kinds,
  });
}

export function RulesetSettings({ ui, ops, refs }) {
  const presets = ui.state.constructor.getGameSystemPresets();
  const current = ui.state.settings.system;
  const [selected, setSelected] = useState(current in presets ? current : Object.keys(presets)[0]);
  const preset = presets[selected] || {};
  const facts = presetFacts(selected, preset);
  const hasSpells = Array.isArray(preset.spell_schools) && preset.spell_schools.length > 0;

  return h('div', { class: 'settings-section' }, [
    h('h3', { class: 'settings-section__title' }, 'Ruleset'),
    // The batched Save reads refs.system; the browser drives it.
    h('input', { type: 'hidden', id: 'settings-system', ref: refs.system, value: selected }),
    h('div', { class: 'ruleset-browser' }, [
      h('ul', { class: 'ruleset-list', role: 'listbox', 'aria-label': 'Game systems' },
        Object.entries(presets).map(([key, p]) => h('li', { key },
          h('button', {
            type: 'button', role: 'option',
            class: `ruleset-list__item${key === selected ? ' ruleset-list__item--on' : ''}`,
            'aria-selected': String(key === selected),
            'data-ruleset-option': key,
            onClick: () => setSelected(key),
          }, [
            h('span', { class: 'ruleset-list__name' }, p.meta?.name ?? key),
            key === current && h('span', { class: 'ruleset-list__badge' }, 'Current'),
          ]))),
      ),
      h('div', { class: 'ruleset-preview' }, [
        h('div', { class: 'ruleset-preview__title' }, preset.meta?.name ?? selected),
        selected === current
          ? h('p', { class: 'settings-hint' }, 'The active system for this campaign.')
          : h('p', { class: 'settings-hint' }, 'Preview. Use Save Settings to switch the campaign to this system.'),
        facts.length > 0 && h('dl', { class: 'ruleset-facts' },
          facts.flatMap((f) => [h('dt', { key: `${f.label}-t` }, f.label), h('dd', { key: `${f.label}-d` }, f.value)])),
        h('div', { class: 'ruleset-preview__flag' }, hasSpells ? '✦ Includes a spell system' : 'No spell system'),
        h('div', { class: 'ruleset-preview__full' }, [
          h('div', { class: 'settings-section__title', style: 'font-size: var(--font-size-sm); margin: var(--space-lg) 0 var(--space-sm);' }, 'Full definition'),
          h('p', { class: 'settings-hint', style: 'margin-bottom: var(--space-sm);' }, 'Every section this system defines. Expand any to inspect it.'),
          h(RulesetDetail, { preset }),
        ]),
      ]),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Ruleset File'),
      h('div', { class: 'settings-btn-row' }, [
        h('button', { type: 'button', class: 'dbt dbt--sm', onClick: () => ops.exportRuleset() }, 'Export Ruleset'),
        h(SaveToLibraryButton, {
          ui, kind: LIBRARY_KIND.RULESET, compact: false, label: 'Save to Library',
          entity: { name: ui.state.settings.systemConfig?.name || ui.state.settings.system },
          ruleset: { system: ui.state.settings.system, systemConfig: ui.state.settings.systemConfig },
        }),
        h('label', { class: 'dbt dbt--sm settings-file-btn' }, [
          'Import Ruleset',
          h('input', {
            type: 'file', accept: '.json,.vttruleset.json', style: 'display: none;',
            onChange: (e) => { const f = e.target.files?.[0]; if (f) { refs.overlay.current?.remove?.(); ops.importRuleset(f); } },
          }),
        ]),
        h('button', { type: 'button', class: 'dbt dbt--sm', title: 'Check a ruleset JSON against the spec', onClick: () => openRulesetValidator() }, 'Validate'),
      ]),
    ]),
  ]);
}

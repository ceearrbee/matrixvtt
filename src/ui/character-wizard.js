/**
 * character-wizard.js - Step-by-step character creation wizard for new players.
 */

import { h } from 'preact';
import * as v from 'valibot';
import { esc } from '../utils/domHelpers.js';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { FormReader, applyFieldErrors } from '../utils/ui-helpers.js';
import { intRange } from '../utils/form-schemas.js';
import { ENTITY_TYPES } from '../utils/constants.js';

const text = (key, label) => ({ key, label, type: 'text' });
const int = (key, label, min = 1, max = undefined) => ({ key, label, type: 'int', min, max });

const DND5E_STEPS = [
  {
    id: 'name',
    label: 'Name & Basics',
    fields: [text('name', 'Name'), text('race', 'Race'), text('class', 'Class'), text('background', 'Background')],
  },
  {
    id: 'stats',
    label: 'Ability Scores',
    fields: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
      .map((k) => int(k, k.charAt(0).toUpperCase() + k.slice(1))),
  },
  {
    id: 'hp',
    label: 'Hit Points & Class',
    fields: [int('level', 'Level'), int('hp_max', 'HP Max'), int('ac', 'AC'), int('speed', 'Speed')],
  },
];

/**
 * Return wizard steps for the given game system. d20-shaped systems keep
 * the classic three steps; everything else derives its steps from the
 * active ruleset so the wizard only asks for stats the system has (a
 * Risus character has cliché dice, not HP Max and AC).
 * @param {string} system
 * @param {object} [ruleset] - active ruleset JSON (settings.systemConfig)
 * @returns {{ id: string, label: string, fields: {key: string, label: string, type: string, min?: number, max?: number}[] }[]}
 */
export function getWizardSteps(system, ruleset) {
  if (system === 'dnd5e' || system === 'pathfinder2e') return DND5E_STEPS;
  const steps = [{ id: 'name', label: 'Name & Basics', fields: [text('name', 'Name')] }];
  const attrs = Array.isArray(ruleset?.attributes) ? ruleset.attributes : [];
  if (attrs.length > 0) {
    steps.push({
      id: 'attributes',
      label: 'Attributes',
      fields: attrs.map((a) => int(a.key, a.label, a.min ?? 0, a.max)),
    });
  }
  return steps;
}

/**
 * Merge wizard form data into a partial character object. d20-shaped
 * systems get the classic full shape; other systems get only a name and
 * the ruleset's own attributes so no D&D fields leak into them.
 * @param {object} data
 * @param {string} system
 * @param {object} [ruleset] - active ruleset JSON (settings.systemConfig)
 * @returns {object}
 */
export function buildCharacterFromWizardData(data, system, ruleset) {
  if (system !== 'dnd5e' && system !== 'pathfinder2e') {
    const attrs = Array.isArray(ruleset?.attributes) ? ruleset.attributes : [];
    return {
      name: data.name ?? '',
      attributes: Object.fromEntries(attrs.map((a) => [a.key, data[a.key] ?? a.min ?? 0])),
      inventory_ids: [],
      type: ENTITY_TYPES.PC,
    };
  }
  const level = data.level ?? 1;
  const hpMax = data.hp_max ?? null;
  return {
    name: data.name ?? '',
    race: data.race ?? '',
    class: data.class ?? '',
    background: data.background ?? '',
    level,
    hp_max: hpMax,
    hp_current: hpMax,
    ac: data.ac ?? 10,
    speed: data.speed ?? 30,
    attributes: {
      strength:     data.strength     ?? 10,
      dexterity:    data.dexterity    ?? 10,
      constitution: data.constitution ?? 10,
      intelligence: data.intelligence ?? 10,
      wisdom:       data.wisdom       ?? 10,
      charisma:     data.charisma     ?? 10,
    },
    inventory_ids: [],
    type: ENTITY_TYPES.PC,
  };
}

function _renderStepFields(step, formData) {
  return step.fields.map(f => {
    const label = esc(f.label);
    const val = esc(String(formData[f.key] ?? ''));
    const isNumber = f.type === 'int';
    const bounds = isNumber
      ? `min="${f.min ?? 1}"${f.max !== undefined ? ` max="${f.max}"` : ''}`
      : '';
    return `
      <div class="form-group">
        <label class="form-label" for="wiz-${f.key}">${label}</label>
        <input type="${isNumber ? 'number' : 'text'}" class="form-input" id="wiz-${f.key}"
               name="${f.key}" value="${val}" ${bounds} placeholder="${label}">
      </div>
    `;
  }).join('');
}

function _renderWizardProgress(steps, currentStep) {
  return steps.map((s, i) =>
    `<span class="wizard-step${i === currentStep ? ' wizard-step--active' : i < currentStep ? ' wizard-step--done' : ''}">${esc(s.label)}</span>`
  ).join('<span class="wizard-step-sep">›</span>');
}

function stepFields(step) {
  return Object.fromEntries(step.fields.map((f) => [
    f.key, f.type === 'int' ? { id: `wiz-${f.key}`, type: 'int' } : `wiz-${f.key}`,
  ]));
}

/**
 * Every numeric field the step declares, held to the bounds the step
 * already puts on its input - the form advertised `min` and `max` and
 * then accepted anything, including the negatives a number input still
 * allows. A cleared field stays cleared, and
 * `buildCharacterFromWizardData` supplies the sheet default.
 * @param {{fields: {key: string, label: string, type: string, min?: number, max?: number}[]}} step
 */
export function wizardStepSchema(step) {
  const entries = step.fields
    .filter((f) => f.type === 'int')
    .map((f) => [f.key, intRange(f.label, f.min, f.max)]);
  return v.object(Object.fromEntries(entries));
}

async function _handleWizardStepSubmit(ui, body, step, formData, system, ruleset, isLast, onFinish) {
  const form = new FormReader(body);
  const fields = stepFields(step);
  const { values: stepData, errors } = form.validate(fields, wizardStepSchema(step));
  if (Object.keys(errors).length > 0) {
    applyFieldErrors(body, errors, fields);
    return false; // stay on this step so the number can be fixed
  }

  Object.assign(formData, stepData);

  if (!isLast) return true; // continue to next step

  onFinish();
  const character = buildCharacterFromWizardData(formData, system, ruleset);
  const charId = 'char-' + Date.now();
  character.id = charId;
  try {
    await ui.state.updateCharacter(charId, character);
    ui.render();
    ui._toast(`${character.name || 'Character'} created!`, 'success');
  } catch (_err) {
    ui._toast('Failed to create character', 'error');
  }
  return false; // finished
}

/**
 * Show the character creation wizard modal.
 */
export function showCharacterWizard(ui) {
  const system = ui.state.settings.system ?? 'dnd5e';
  const ruleset = ui.state.settings.systemConfig;
  const steps = getWizardSteps(system, ruleset);
  let currentStep = 0;
  const formData = {};

  // The step bodies are still built as HTML strings (every user-authored
  // value routed through `esc`); the shared Modal owns the overlay,
  // header, focus trap and Escape around them.
  const body = document.createElement('div');
  const close = openModal((dispose) => h(Modal, {
    id: 'char-wizard-modal',
    title: 'Create Character',
    maxWidth: '480px',
    onClose: dispose,
  }, h('div', { ref: (el) => el?.appendChild(body) })));

  function renderStep() {
    const step = steps[currentStep];
    const isFirst = currentStep === 0;
    const isLast = currentStep === steps.length - 1;

    // _renderWizardProgress and _renderStepFields produce HTML internally;
    // every user-authored field (step.label, formData values) is routed
    // through `esc(...)` before insertion. Trust contract verified in the
    // helper definitions above.
    // eslint-disable-next-line vtt/no-raw-html-interpolation
    body.innerHTML = `
      <div class="wizard-progress" style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:var(--space-2xl);display:flex;flex-wrap:wrap;gap:var(--space-xs);align-items:center;">${_renderWizardProgress(steps, currentStep)}</div>
      <h3 class="wizard-step-label">${esc(step.label)}</h3>
      <form id="wizard-step-form">
        ${_renderStepFields(step, formData)}
        <div style="margin-top: var(--space-2xl); padding: var(--space-lg); background: var(--color-background-secondary); border-radius: var(--border-radius-lg); border: 0.5px solid var(--color-border-primary);">
          <p style="margin: 0; font-size: 11px; color: var(--color-text-secondary); line-height: 1.4;">
            <strong>Character Note:</strong> Characters are stored securely on your Matrix accounts server. All changes are synced in real-time.
          </p>
        </div>
        <div class="form-actions">
          ${!isFirst ? `<button type="button" class="dbt" id="wiz-back">← Back</button>` : ''}
          <button type="submit" class="dbt btn-primary" style="flex:1;">${isLast ? 'Create Character' : 'Next →'}</button>
        </div>
      </form>
    `;

    body.querySelector('#wiz-back')?.addEventListener('click', () => { currentStep--; renderStep(); });
    body.querySelector('#wizard-step-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await _handleWizardStepSubmit(ui, body, step, formData, system, ruleset, isLast, close)) {
        currentStep++;
        renderStep();
      }
    });

    /** @type {HTMLElement|null} */ (body.querySelector(`#wiz-${step.fields[0].key}`))?.focus();
  }

  renderStep();
}

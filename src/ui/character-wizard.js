/**
 * character-wizard.js - Step-by-step character creation wizard for new players.
 */

import { esc } from '../utils/domHelpers.js';
import { FormReader } from '../utils/ui-helpers.js';
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

async function _handleWizardStepSubmit(ui, modal, step, formData, system, ruleset, isLast) {
  const form = new FormReader(modal);
  const stepData = form.collect(Object.fromEntries(step.fields.map(f => [
    f.key, f.type === 'int' ? { id: `wiz-${f.key}`, type: 'int' } : `wiz-${f.key}`,
  ])));
  
  Object.assign(formData, stepData);

  if (!isLast) return true; // continue to next step

  modal.remove();
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

  const existing = document.getElementById('char-wizard-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'char-wizard-modal';
  modal.className = 'modal-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'wizard-title');

  async function renderStep() {
    const step = steps[currentStep];
    const isFirst = currentStep === 0;
    const isLast = currentStep === steps.length - 1;

    // _renderWizardProgress and _renderStepFields produce HTML internally;
    // every user-authored field (step.label, formData values) is routed
    // through `esc(...)` before insertion. Trust contract verified in the
    // helper definitions above.
    // eslint-disable-next-line vtt/no-raw-html-interpolation
    modal.innerHTML = `
      <div class="modal-content" style="max-width:480px">
        <div class="modal-header">
          <h2 class="modal-title" id="wizard-title">Create Character - ${esc(step.label)}</h2>
          <button class="modal-close dbt" aria-label="Close" id="wiz-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="wizard-progress" style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:16px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">${_renderWizardProgress(steps, currentStep)}</div>
          <form id="wizard-step-form">
            ${_renderStepFields(step, formData)}
            <div style="margin-top: 16px; padding: 10px; background: var(--color-background-secondary); border-radius: 4px; border: 0.5px solid var(--color-border-primary);">
              <p style="margin: 0; font-size: 11px; color: var(--color-text-secondary); line-height: 1.4;">
                <strong>Character Note:</strong> Characters are stored securely on your Matrix accounts server. All changes are synced in real-time.
              </p>
            </div>
            <div class="form-actions">
              ${!isFirst ? `<button type="button" class="dbt" id="wiz-back">← Back</button>` : ''}
              <button type="submit" class="dbt btn-primary" style="flex:1;">${isLast ? 'Create Character' : 'Next →'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modal.querySelector('#wiz-close')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#wiz-back')?.addEventListener('click', () => { currentStep--; renderStep(); });
    modal.querySelector('#wizard-step-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await _handleWizardStepSubmit(ui, modal, step, formData, system, ruleset, isLast)) {
        currentStep++;
        renderStep();
      }
    });

    modal.querySelector(`#wiz-${step.fields[0].key}`)?.focus();
  }

  renderStep();
  document.body.appendChild(modal);
}

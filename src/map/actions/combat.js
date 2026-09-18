/**
 * Combat-related token actions: damage, healing, conditions.
 */

import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { openModal } from '../../ui/modal-host.js';
import { VTT_EVENTS, EVENT_TYPES } from '../../utils/constants.js';
import { emitVttError as emitError } from '../../utils/errorHandling.js';
import { updateTokenSafe } from './tokens.js';
import { getConcentratingSpell } from '../../ui/spells-tab.js';
import { computeDerived } from '../../engine/computeDerived.js';
import { getConditions, conditionLabel } from '../../state/rulesets.js';

/**
 * Stress-model damage/heal. Damage ticks boxes on the linked sheet and
 * mirrors the track onto the token so the pip overlay updates. With
 * uniform 1-capacity boxes (Risus dice lost) an N-point hit ticks N
 * boxes; graduated boxes (FATE) keep capacity-fit semantics: the first
 * free box that can absorb the whole hit.
 * Returns true when the stress path handled the write; false defers to
 * the hp-pool path.
 */
async function applyStressHarm(mr, tokenId, amount, { heal = false } = {}) {
  const harmModel = mr.state.settings?.systemConfig?.harm_model;
  if (harmModel?.type !== 'stress') return false;

  const token = mr.state.tokens.get(tokenId);
  if (!token) return true;
  const isCharacter = token.sheet_id && mr.state.characters.has(token.sheet_id);
  const sheet = token.sheet_id
    ? (mr.state.characters.get(token.sheet_id) ?? mr.state.npcs.get(token.sheet_id))
    : null;
  const capacities = harmModel.boxes ?? [];
  const source = sheet ?? token;
  const boxes = Array.isArray(source.stress)
    ? [...source.stress]
    : capacities.map(() => false);

  if (heal) {
    let left = amount;
    for (let i = boxes.length - 1; i >= 0 && left > 0; i--) {
      if (boxes[i]) { boxes[i] = false; left--; }
    }
  } else if (capacities.every((c) => c === 1)) {
    let left = amount;
    for (let i = 0; i < boxes.length && left > 0; i++) {
      if (!boxes[i]) { boxes[i] = true; left--; }
    }
  } else {
    for (let i = 0; i < capacities.length; i++) {
      if (!boxes[i] && capacities[i] >= amount) { boxes[i] = true; break; }
    }
  }

  try {
    if (sheet) {
      const write = isCharacter
        ? (id, v) => mr.state.updateCharacter(id, v)
        : (id, v) => mr.state.updateNPC(id, v);
      await write(sheet.id, { ...sheet, stress: boxes });
    }
    await mr.state.updateToken(tokenId, { ...token, stress: boxes });
    _broadcastDamageAudit(mr, {
      target_id: tokenId, target_name: token.name,
      delta: heal ? amount : -amount, kind: heal ? 'heal' : 'damage',
    });
  } catch (e) {
    emitError(heal ? 'Failed to apply healing' : 'Failed to apply damage', e);
  }
  return true;
}

function DamageDialog({ mr, tokenId, isHeal, onClose }) {
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  // Inline error so the user sees "Enter a positive number" without the
  // modal closing on them, instead of a silent early-return on amt <= 0.
  const apply = async () => {
    const input = rootRef.current.querySelector('#dmg-amount');
    const amt = parseInt(input.value) || 0;
    if (amt <= 0) { setError('Enter a positive number.'); input.focus(); return; }
    onClose();
    if (isHeal) await applyHealing(mr, tokenId, amt);
    else await applyDamage(mr, tokenId, amt);
  };
  return h('div', { ref: rootRef }, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'dmg-amount' }, 'Amount'),
      h('input', { type: 'number', class: 'form-input', id: 'dmg-amount', defaultValue: 0, min: '1' }),
    ]),
    error && h('div', { class: 'form-error', style: 'color:var(--color-text-danger);font-size:var(--font-size-xs);margin-top:var(--space-sm);' }, error),
    h('div', { class: 'form-actions' }, [
      h('button', { class: 'dbt', 'data-modal-close': true }, 'Cancel'),
      h('button', { class: 'dbt btn-primary', id: 'dmg-apply-btn', onClick: apply }, isHeal ? 'Apply Healing' : 'Apply Damage'),
    ]),
  ]);
}

export function showDamageDialog(mr, tokenId, type = 'damage') {
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  const isHeal = type === 'heal';
  openModal((close) =>
    h(Modal, {
      id: 'dmg-modal', title: `${isHeal ? 'Heal' : 'Damage'} ${token.name}`,
      maxWidth: '300px', autoFocusSelector: '#dmg-amount', onClose: close,
    }, h(DamageDialog, { mr, tokenId, isHeal, onClose: close })),
  );
}

export async function applyDamage(mr, tokenId, amount) {
  if (await applyStressHarm(mr, tokenId, amount)) return;
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  const newHp = Math.max(0, token.hp_current - amount);
  const ok = await updateTokenSafe(mr, tokenId, { ...token, hp_current: newHp }, 'Failed to apply damage');
  if (!ok) return;
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.DAMAGE, {
    detail: { tokenId, tokenName: token.name, damage: amount, newHp, maxHp: token.hp_max },
  }));
  _broadcastDamageAudit(mr, {
    target_id: tokenId, target_name: token.name, delta: -amount, kind: 'damage',
  });
  _maybeAnnounceConcentration(mr, token, amount);
}

function _maybeAnnounceConcentration(mr, token, damage) {
  const character = mr.state.characters?.get?.(token.sheet_id);
  if (!character) return;
  const entry = getConcentratingSpell(character, mr.state.spells);
  if (!entry) return;
  const dc = computeDerived(mr.state.settings?.systemConfig, 'concentration_dc', { damage });
  if (dc == null) return;
  const body = `⚠ ${character.name} must roll a Constitution save (DC ${dc}) to maintain concentration on ${entry.spell.name}.`;
  mr.state.sendRoomEvent('m.room.message', { msgtype: 'm.notice', body })
    .catch(() => { /* prompt is best-effort */ });
}

function _broadcastDamageAudit(mr, entry) {
  if (!mr.state?.sendRoomEvent) return;
  mr.state.sendRoomEvent(EVENT_TYPES.DAMAGE_EVENT, {
    ts: Date.now(),
    actor: mr.state.widgetManager?.userId ?? null,
    ...entry,
  }).catch(() => { /* audit is best-effort; local log already captured it */ });
}

export async function applyDamageToTokens(mr, tokenIds, amount) {
  for (const id of tokenIds) {
    if (await applyStressHarm(mr, id, amount)) continue;
    const token = mr.state.tokens.get(id);
    if (!token) continue;
    const newHp = Math.max(0, token.hp_current - amount);
    const next = { ...token, hp_current: newHp };
    try {
      await mr.state.updateToken(id, next);
      window.dispatchEvent(new CustomEvent(VTT_EVENTS.DAMAGE, {
        detail: { tokenId: id, tokenName: token.name, damage: amount, newHp, maxHp: token.hp_max },
      }));
      _broadcastDamageAudit(mr, {
        target_id: id, target_name: token.name, delta: -amount, kind: 'damage',
      });
      _maybeAnnounceConcentration(mr, token, amount);
    } catch (e) {
      emitError('Failed to apply damage', e);
    }
  }
}

export async function applyHealing(mr, tokenId, amount) {
  if (await applyStressHarm(mr, tokenId, amount, { heal: true })) return;
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  const newHp = Math.min(token.hp_max, token.hp_current + amount);
  const ok = await updateTokenSafe(mr, tokenId, { ...token, hp_current: newHp }, 'Failed to apply healing');
  if (!ok) return;
  window.dispatchEvent(new CustomEvent(VTT_EVENTS.HEAL, {
    detail: { tokenId, tokenName: token.name, heal: amount, newHp, maxHp: token.hp_max },
  }));
  _broadcastDamageAudit(mr, {
    target_id: tokenId, target_name: token.name, delta: amount, kind: 'heal',
  });
}

/**
 * Conditions are a filterable list, not a fifteen-row grid of
 * checkbox-plus-number. Fourteen of the fifteen rounds inputs were
 * permanently disabled; a row's rounds field now appears when that row
 * is ticked, which is the only time it can be used.
 */
function ConditionDialog({ mr, tokenId, token, onClose }) {
  const priorDurations = token.condition_durations || {};
  const [selected, setSelected] = useState(() => new Set(token.conditions || []));
  const [durations, setDurations] = useState(() => {
    const out = {};
    for (const [cond, d] of Object.entries(priorDurations)) {
      if (d?.duration_rounds) out[cond] = String(d.duration_rounds);
    }
    return out;
  });
  const [filter, setFilter] = useState('');

  const systemConfig = mr.state?.settings?.systemConfig;
  // The system's own vocabulary, plus anything already on the token
  // that the system does not declare (a hand-typed or imported one).
  const declared = getConditions(systemConfig).map((c) => c.key);
  const all = [...declared, ...[...selected].filter((c) => !declared.includes(c))];

  const needle = filter.trim().toLowerCase();
  // A condition the token already has stays listed whatever the filter
  // says, so a filter can never hide something that is in effect.
  const shown = all.filter((c) => !needle
    || c.toLowerCase().includes(needle)
    || conditionLabel(systemConfig, c).toLowerCase().includes(needle)
    || selected.has(c));

  // A ruleset that declares no conditions, or a name this one does not
  // carry, would otherwise be a dead end: the filter doubles as the
  // way to add one.
  const typed = filter.trim();
  const canAddTyped = typed !== '' && !all.some(
    (c) => c.toLowerCase() === typed.toLowerCase()
      || conditionLabel(systemConfig, c).toLowerCase() === typed.toLowerCase(),
  );
  const addTyped = () => {
    setSelected(new Set([...selected, typed.toLowerCase()]));
    setFilter('');
  };

  const toggle = (cond) => (e) => {
    const next = new Set(selected);
    if (e.currentTarget.checked) next.add(cond);
    else next.delete(cond);
    setSelected(next);
  };

  const save = async () => {
    const out = {};
    for (const cond of selected) {
      const rounds = parseInt(durations[cond] ?? '', 10);
      if (Number.isFinite(rounds) && rounds > 0) out[cond] = { duration_rounds: rounds };
    }
    onClose();
    await updateTokenSafe(
      mr, tokenId,
      { ...token, conditions: [...selected], condition_durations: out },
      'Failed to update conditions',
    );
  };

  return h('div', null, [
    h('p', { class: 'form-help', style: 'margin-top:0;' },
      "Tick a condition to apply it. Rounds is optional - leave blank for an effect you'll clear manually."),
    h('label', { class: 'sr-only', for: 'cond-filter' }, 'Filter conditions'),
    h('input', {
      type: 'search', id: 'cond-filter', class: 'form-input',
      placeholder: 'Filter conditions…', autocomplete: 'off',
      value: filter,
      onInput: (e) => setFilter(e.currentTarget.value),
    }),
    h('div', { class: 'cond-list', role: 'group', 'aria-label': 'Conditions and durations' },
      shown.map((c) => h('div', { class: 'cond-list__row', key: c }, [
        h('label', { class: 'cond-grid__label', for: `cond-chk-${c}` }, [
          h('input', {
            type: 'checkbox', id: `cond-chk-${c}`, class: 'cond-check', value: c,
            checked: selected.has(c), onChange: toggle(c),
          }),
          h('span', null, conditionLabel(systemConfig, c)),
        ]),
        selected.has(c) && h('input', {
          type: 'number', id: `cond-dur-${c}`, class: 'cond-duration form-input cond-grid__duration',
          'data-condition': c, min: '0', step: '1', placeholder: 'rounds',
          value: durations[c] ?? '',
          'aria-label': `${conditionLabel(systemConfig, c)} rounds until expiry`,
          title: 'Rounds until auto-expiry. Blank = never expires (clear manually).',
          onInput: (e) => setDurations({ ...durations, [c]: e.currentTarget.value }),
        }),
      ]))),
    canAddTyped && h('button', {
      type: 'button', class: 'dbt', onClick: addTyped,
    }, `Add "${typed}"`),
    shown.length === 0 && !canAddTyped && h('p', { class: 'form-help' },
      declared.length === 0
        ? 'This game system declares no conditions. Type one above to add it.'
        : `No condition matches "${filter}".`),
    h('div', { class: 'form-actions' }, [
      h('button', { class: 'dbt', 'data-modal-close': true }, 'Cancel'),
      h('button', { class: 'dbt btn-primary', id: 'cond-apply-btn', onClick: save }, 'Save Conditions'),
    ]),
  ]);
}

export function showConditionDialog(mr, tokenId) {
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  openModal((close) =>
    h(Modal, { id: 'cond-modal', title: `Conditions: ${token.name}`, maxWidth: '420px', onClose: close },
      h(ConditionDialog, { mr, tokenId, token, onClose: close })),
  );
}

export async function addCondition(mr, tokenId, cond) {
  const t = mr.state.tokens.get(tokenId);
  if (!t || (t.conditions || []).includes(cond)) return;
  await updateTokenSafe(mr, tokenId, { ...t, conditions: [...(t.conditions || []), cond] }, 'Failed to add condition');
}

export function tickConditionDurations(token) {
  const durations = token.condition_durations;
  if (!durations || typeof durations !== 'object') return [];
  const expired = [];
  for (const [key, meta] of Object.entries(durations)) {
    meta.duration_rounds--;
    if (meta.duration_rounds <= 0) {
      expired.push(key);
      delete durations[key];
      token.conditions = token.conditions.filter(c => c !== key);
    }
  }
  return expired;
}

export async function removeCondition(mr, tokenId, cond) {
  const t = mr.state.tokens.get(tokenId);
  if (!t || !(t.conditions || []).includes(cond)) return;
  await updateTokenSafe(mr, tokenId, { ...t, conditions: t.conditions.filter(c => c !== cond) }, 'Failed to remove condition');
}

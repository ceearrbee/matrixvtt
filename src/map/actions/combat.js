/**
 * Combat-related token actions: damage, healing, conditions.
 */

import { h } from 'preact';
import { useState, useRef, useLayoutEffect } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { openModal } from '../../ui/modal-host.js';
import { VTT_EVENTS, EVENT_TYPES } from '../../utils/constants.js';
import { emitVttError as emitError } from '../../utils/errorHandling.js';
import { updateTokenSafe } from './tokens.js';
import { getConcentratingSpell } from '../../ui/spells-tab.js';
import { computeDerived } from '../../engine/computeDerived.js';

const CONDITIONS = [
  'prone', 'poisoned', 'stunned', 'paralyzed', 'charmed', 'frightened',
  'blinded', 'deafened', 'invisible', 'unconscious', 'concentration',
];

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
    error && h('div', { class: 'form-error', style: 'color:var(--color-text-danger);font-size:var(--font-size-xs);margin-top:6px;' }, error),
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

function ConditionDialog({ mr, tokenId, token, onClose }) {
  const current = token.conditions || [];
  const priorDurations = token.condition_durations || {};
  const rootRef = useRef(null);

  // Enable/disable each row's duration input as its checkbox toggles -
  // wired imperatively (synchronously) to match the legacy behavior.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const cbs = Array.from(root.querySelectorAll('.cond-check'));
    const onChange = (cb) => () => {
      const dur = root.querySelector(`.cond-duration[data-condition="${cb.value}"]`);
      if (!dur) return;
      dur.disabled = !cb.checked;
      if (cb.checked) dur.focus();
    };
    const handlers = cbs.map((cb) => { const fn = onChange(cb); cb.addEventListener('change', fn); return [cb, fn]; });
    return () => handlers.forEach(([cb, fn]) => cb.removeEventListener('change', fn));
  }, []);

  const save = async () => {
    const root = rootRef.current;
    const selected = Array.from(root.querySelectorAll('.cond-check:checked')).map((i) => i.value);
    const durations = {};
    for (const cond of selected) {
      const el = root.querySelector(`.cond-duration[data-condition="${cond}"]`);
      const rounds = parseInt(el?.value ?? '', 10);
      if (Number.isFinite(rounds) && rounds > 0) durations[cond] = { duration_rounds: rounds };
    }
    onClose();
    await updateTokenSafe(
      mr, tokenId,
      { ...token, conditions: selected, condition_durations: durations },
      'Failed to update conditions',
    );
  };

  return h('div', { ref: rootRef }, [
    h('p', { class: 'form-help', style: 'margin-top:0;' },
      "Tick a condition to apply it. Rounds is optional - leave blank for an effect you'll clear manually."),
    h('div', { class: 'cond-grid', role: 'group', 'aria-label': 'Conditions and durations' }, [
      h('div', { class: 'cond-grid__header' }, 'Condition'),
      h('div', { class: 'cond-grid__header', style: 'text-align:right;' }, 'Rounds'),
      ...CONDITIONS.flatMap((c) => {
        const isChecked = current.includes(c);
        const dur = priorDurations[c]?.duration_rounds ?? '';
        return [
          h('label', { class: 'cond-grid__label', for: `cond-chk-${c}`, key: `l-${c}` }, [
            h('input', { type: 'checkbox', id: `cond-chk-${c}`, class: 'cond-check', value: c, defaultChecked: isChecked }),
            h('span', null, c),
          ]),
          h('input', {
            type: 'number', id: `cond-dur-${c}`, key: `d-${c}`, class: 'cond-duration form-input cond-grid__duration',
            'data-condition': c, min: '0', step: '1', placeholder: '-', defaultValue: dur,
            'aria-label': `${c} rounds until expiry`, disabled: !isChecked,
            title: 'Rounds until auto-expiry. Blank = never expires (clear manually).',
          }),
        ];
      }),
    ]),
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

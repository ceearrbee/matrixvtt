/**
 * Attack selection + resolution modal. Pure resolution logic lives in
 * attack-modal.js.
 */

import { h, render } from 'preact';
import { CombatIcon, DiceIcon } from './icons/index.jsx';
import { useRef, useState } from 'preact/hooks';
import { resolveAttack } from './attack-modal.js';
import { tokensSignal, charactersSignal, npcsSignal } from '../state/signals.js';

const closeOverlay = (host) => { render(null, host); host.remove(); };

function SelectMode({ ui, attackerTokenId, targetTokenId, onConfirm, onClose }) {
  // Subscribe so the attacker's sheet, attacks, and target name stay
  // current if any of those entities change while the modal is open.
  tokensSignal.value; charactersSignal.value; npcsSignal.value;
  const selectRef = useRef(null);
  const attackerToken = ui.state.tokens.get(attackerTokenId);
  const sheet = ui.state.characters.get(attackerToken.sheet_id) || ui.state.npcs.get(attackerToken.sheet_id);
  const attacks = sheet?.attacks?.length
    ? sheet.attacks
    : [{ name: 'Unarmed Strike', attack_bonus: 0, damage: '1', damage_type: 'bludgeoning' }];
  const targetToken = ui.state.tokens.get(targetTokenId);

  const confirm = () => onConfirm(attacks[parseInt(selectRef.current.value)]);

  return h('div', {
    class: 'modal-overlay',
    tabIndex: -1,
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
    onKeyDown: (e) => { if (e.key === 'Escape') onClose(); },
  },
    h('div', {
      class: 'modal-content', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'attack-select-title', style: 'max-width: 320px;',
    }, [
      h('div', { class: 'modal-header' }, [
        h('h2', { id: 'attack-select-title' }, `Attack ${targetToken ? targetToken.name : 'Target'}`),
        h('button', { class: 'modal-close', 'aria-label': 'Close', onClick: onClose }, '✕'),
      ]),
      h('div', { class: 'modal-body' }, [
        h('label', { class: 'form-label', for: 'attack-select' }, 'Choose Attack'),
        h('select', {
          class: 'form-select', id: 'attack-select', ref: selectRef,
          style: 'margin-bottom:12px;', title: 'Select which of your attacks to use',
        }, attacks.map((a, i) => {
          const bonus = a.attack_bonus != null ? ` (${a.attack_bonus >= 0 ? '+' : ''}${a.attack_bonus})` : '';
          return h('option', { value: i }, `${a.name || 'Attack'}${bonus}`);
        })),
        h('div', { class: 'form-actions' }, [
          h('button', { class: 'btn-primary', onClick: confirm, 'aria-label': 'Confirm attack selection and roll', title: 'Proceed to target selection' }, [h(CombatIcon, {}), ' Roll Attack']),
          h('button', { class: 'btn-secondary', onClick: onClose, 'aria-label': 'Cancel attack', title: 'Discard attack' }, 'Cancel'),
        ]),
      ]),
    ]));
}

function ResolveMode({ ui, attackerTokenId, attackData, targetTokenId, onClose }) {
  // Subscribe so the target dropdown picks up tokens added/removed
  // while the modal is open.
  tokensSignal.value;
  const targetRef = useRef(null);
  const resultRef = useRef(null);
  const attackerToken = ui.state.tokens.get(attackerTokenId);
  const isGM = ui.state.isGM();

  const targets = [];
  for (const [tid, t] of ui.state.tokens.entries()) {
    if (tid === attackerTokenId) continue;
    if (!isGM && t.visible === false) continue;
    targets.push([tid, t]);
  }

  const bonusStr = attackData.attack_bonus != null
    ? (attackData.attack_bonus >= 0 ? `+${attackData.attack_bonus}` : `${attackData.attack_bonus}`)
    : '±0';

  const onRoll = async () => {
    await resolveAttack(ui, attackerTokenId, targetRef.current.value, attackData, resultRef.current);
    const btn = resultRef.current?.querySelector('#apply-damage-btn');
    if (btn) btn.addEventListener('click', async () => {
      const damageTotal = parseInt(btn.dataset.damage);
      await ui.mapRenderer?.applyDamage(targetRef.current.value, damageTotal);
      await ui.toggleCombatAction('action_used');
      btn.disabled = true;
      btn.textContent = `✓ Applied ${damageTotal} damage`;
    });
  };

  return h('div', {
    class: 'modal-overlay',
    tabIndex: -1,
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
    onKeyDown: (e) => { if (e.key === 'Escape') onClose(); },
  },
    h('div', {
      class: 'modal-content', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'attack-modal-title', style: 'max-width: 360px;',
    }, [
      h('div', { class: 'modal-header' }, [
        h('h2', { id: 'attack-modal-title' }, `Attack: ${attackData.name || 'Melee'}`),
        h('button', { class: 'modal-close', 'aria-label': 'Close', onClick: onClose }, '✕'),
      ]),
      h('div', { class: 'modal-body' }, [
        h('div', { style: 'margin-bottom:12px;' }, [
          h('div', { style: 'font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-bottom:6px;' }, [
            h('strong', null, attackerToken.name), ` · ${bonusStr} to hit`,
            attackData.damage ? ` · ${attackData.damage}${attackData.damage_type ? ` ${attackData.damage_type}` : ''}` : '',
          ]),
          h('div', { class: 'form-group' }, [
            h('label', { class: 'form-label', for: 'attack-target' }, 'Target'),
            h('select', {
              class: 'form-select', id: 'attack-target', ref: targetRef,
              title: 'Select the creature you are targeting',
            }, targets.map(([tid, t]) => h('option', { value: tid, selected: tid === targetTokenId }, t.name))),
          ]),
        ]),
        h('div', { id: 'attack-result-area', ref: resultRef }),
        h('div', { class: 'form-actions' }, [
          h('button', { class: 'btn-primary', onClick: onRoll, 'aria-label': 'Roll the attack dice', title: 'Roll d20 + modifiers' }, [h(DiceIcon, {}), ' Roll Attack']),
          h('button', { class: 'btn-secondary', onClick: onClose, 'aria-label': 'Close attack modal', title: 'Finish and close' }, 'Close'),
        ]),
      ]),
    ]));
}

function AttackModal({ ui, attackerTokenId, attackData, targetTokenId, initialMode, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [data, setData] = useState(attackData);

  if (mode === 'select') {
    return h(SelectMode, {
      ui, attackerTokenId, targetTokenId, onClose,
      onConfirm: (picked) => { setData(picked); setMode('resolve'); },
    });
  }
  return h(ResolveMode, { ui, attackerTokenId, attackData: data, targetTokenId, onClose });
}

function mount(ui, props) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const onClose = () => closeOverlay(host);
  render(h(AttackModal, { ui, onClose, ...props }), host);
}

export async function openAttackSelectModal(ui, targetTokenId) {
  const { order = [], current_index = 0 } = ui.state.initiative ?? {};
  const currentEntry = order[current_index];
  if (!currentEntry) return;

  const attackerTokenId = currentEntry.token_id;
  const attackerToken = ui.state.tokens.get(attackerTokenId);
  if (!attackerToken) return;

  const sheet = ui.state.characters.get(attackerToken.sheet_id) || ui.state.npcs.get(attackerToken.sheet_id);
  const attacks = sheet?.attacks?.length
    ? sheet.attacks
    : [{ name: 'Unarmed Strike', attack_bonus: 0, damage: '1', damage_type: 'bludgeoning' }];

  if (attacks.length === 1) {
    await ui._showAttackModal(attackerTokenId, attacks[0], targetTokenId);
    return;
  }
  mount(ui, { attackerTokenId, targetTokenId, initialMode: 'select' });
}

export async function openAttackResolveModal(ui, attackerTokenId, attackData, targetTokenId = null) {
  mount(ui, { attackerTokenId, attackData, targetTokenId, initialMode: 'resolve' });
}

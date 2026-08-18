/**
 * Token-level map actions: visibility, HP-visibility, removal, facing reset,
 * and the "add token" dialog.
 */

import { h } from 'preact';
import { FormReader } from '../../utils/ui-helpers.js';
import { Modal } from '../../ui/Modal.jsx';
import { openModal } from '../../ui/modal-host.js';
import { confirm } from '../../ui/confirm-dialogs.jsx';
import { emitVttError as emitError } from '../../utils/errorHandling.js';
import { ENTITY_TYPES } from '../../utils/constants.js';
import { allocateEntityId } from '../../utils/stable-id.js';
import { rulesetTracksHP, rulesetHasFormField } from '../../ui/entity-form/system-fields.js';

/**
 * Move a token by `(dx, dy)` grid cells. Canonical helper for any
 * grid-snapped move - keyboard arrows, mobile gestures, scripts.
 * Silent no-op if the token is gone.
 */
export async function moveTokenBy(mr, tokenId, dx, dy) {
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  const col = (token.col ?? 0) + dx;
  const row = (token.row ?? 0) + dy;
  await mr.state.updateToken(tokenId, { ...token, col, row });
}

export async function updateTokenSafe(mr, tokenId, updated, errorMessage) {
  try {
    await mr.state.updateToken(tokenId, updated);
    return true;
  } catch (e) {
    emitError(errorMessage, e);
    return false;
  }
}

export async function toggleTokenVisibility(mr, tokenId) {
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  await updateTokenSafe(mr, tokenId, { ...token, visible: token.visible === false }, 'Failed to update token visibility');
}

export async function toggleTokenHPVisibility(mr, tokenId) {
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  await updateTokenSafe(mr, tokenId, { ...token, show_hp: token.show_hp === false }, 'Failed to update HP visibility');
}

export function removeToken(mr, tokenId) {
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  confirm(
    h('span', null, ['Remove ', h('strong', null, token.name), ' from the map?']),
    async () => {
      try {
        await mr.state.updateToken(tokenId, {});
        if (mr.selectedToken === tokenId) mr.setSelectedToken(null);
        if (mr.state.selectedToken === tokenId) mr.state.selectedToken = null;
        // Mid-combat removals must drop the initiative entry; otherwise
        // the next-turn cycle lands on a tombstoned token id.
        await window.ui?.removeFromInitiative?.(tokenId);
      } catch (e) {
        emitError('Failed to remove token', e);
      }
    },
    { id: 'remove-confirm-modal', confirmId: 'remove-confirm-btn' }
  );
}

export async function clearFacing(mr, tokenId) {
  const token = mr.state.tokens.get(tokenId);
  if (!token) return;
  await updateTokenSafe(mr, tokenId, { ...token, facing: null }, 'Failed to clear facing');
}

function AddTokenForm({ mr, col, row, onClose }) {
  const systemConfig = mr.state.settings?.systemConfig;
  const showHP = rulesetTracksHP(systemConfig);
  const showAC = rulesetHasFormField(systemConfig, 'ac');
  const onSubmit = async (e) => {
    e.preventDefault();
    const data = new FormReader(e.currentTarget).collect({
      name: 'token-name',
      type: 'token-type',
      ...(showHP ? { hp_max: { id: 'token-hp-max', type: 'int' } } : {}),
      ...(showAC ? { ac: { id: 'token-ac', type: 'int' } } : {}),
    });
    onClose();
    const tokenId = await allocateEntityId('tok', mr.state.tokens);
    const token = {
      ...data, id: tokenId, map_id: mr.state.activeMapId, col, row,
      ...(showHP ? { hp_current: data.hp_max } : {}),
      visible: true, size: 1,
      owner_user_id: mr.state.widgetManager.userId,
    };
    await updateTokenSafe(mr, tokenId, token, 'Failed to add token');
  };

  return h('form', { id: 'add-token-form', onSubmit }, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'token-name' }, ['Name ', h('span', { 'aria-hidden': 'true' }, '*')]),
      h('input', { type: 'text', class: 'form-input', id: 'token-name', required: true }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'token-type' }, 'Type'),
      h('select', { class: 'form-select', id: 'token-type' }, [
        h('option', { value: ENTITY_TYPES.PC }, 'Player Character'),
        h('option', { value: ENTITY_TYPES.NPC }, 'NPC / Monster'),
      ]),
    ]),
    (showHP || showAC) && h('div', { class: 'form-row' }, [
      showHP && h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'token-hp-max' }, 'HP Max'),
        h('input', { type: 'number', class: 'form-input', id: 'token-hp-max', defaultValue: 10 }),
      ]),
      showAC && h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'token-ac' }, 'AC'),
        h('input', { type: 'number', class: 'form-input', id: 'token-ac', defaultValue: 10 }),
      ]),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-modal-close': true }, 'Cancel'),
      h('button', { type: 'submit', class: 'dbt btn-primary' }, 'Add Token'),
    ]),
  ]);
}

export function showAddTokenDialog(mr, col, row) {
  openModal((close) =>
    h(Modal, {
      id: 'add-token-modal', title: 'Add Token', maxWidth: '350px',
      autoFocusSelector: '#token-name',
      // Dirty once the user has typed a name (other fields have sensible
      // defaults; an empty name means they haven't started).
      isDirty: () => !!document.querySelector('#add-token-modal #token-name')?.value.trim(),
      onClose: close,
    }, h(AddTokenForm, { mr, col, row, onClose: close })),
  );
}

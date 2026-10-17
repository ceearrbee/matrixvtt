/**
 * TokenActionBar.jsx - contextual actions for the selected token,
 * docked at the top of the map region (tldraw pattern). Renders only
 * while a token is selected; every action also exists in the token's
 * right-click menu or the sheet, so the bar is an accelerator, not
 * the only path.
 */

import { h } from 'preact';
import {
  selectedTokenSignal,
  selectedTokenIdsSignal,
  companionCollapsedSignal,
  activeTabSignal,
  selectedEntitySignal,
  selectedCharacterIdSignal,
  selectedNPCIdSignal,
} from '../state/ui-signals.js';
import { tokensSignal } from '../state/signals.js';
import { buildTokenBarActions } from './token-bar-actions.js';

export function TokenActionBar({ ui }) {
  const selectedId = selectedTokenSignal.value;
  const token = selectedId ? tokensSignal.value?.get?.(selectedId) : null;
  if (!token) return null;

  // Mutual exclusion: when Right Companion is expanded and inspecting this token's sheet/NPC
  const isCompanionOpen = !companionCollapsedSignal.value;
  const tab = activeTabSignal.value;
  const isInspectingTab = tab === 'npcs' || tab === 'npc' || tab === 'sheet';
  const inspectingEntityId = selectedEntitySignal?.value
    ?? (tab === 'sheet' ? selectedCharacterIdSignal.value : selectedNPCIdSignal.value);
  const tokenEntityId = token.sheet_id || token.character_id || token.npc_id || token.id;
  const matchesEntity = inspectingEntityId && (
    inspectingEntityId === tokenEntityId ||
    inspectingEntityId === token.id ||
    (token.sheet_id && inspectingEntityId === token.sheet_id) ||
    (token.character_id && inspectingEntityId === token.character_id) ||
    (token.npc_id && inspectingEntityId === token.npc_id)
  );

  if (isCompanionOpen && isInspectingTab && matchesEntity) {
    return null;
  }

  const isGM = ui.state?.isGM?.() === true;
  const isOwner = token.owner_user_id != null
    && token.owner_user_id === ui.widgetManager?.userId;
  const selectionSize = selectedTokenIdsSignal.value.size;
  const actions = buildTokenBarActions({ isGM, isOwner, token, selectionSize });
  if (actions.length === 0) return null;

  const label = selectionSize > 1
    ? `Actions for ${selectionSize} selected tokens`
    : `Actions for ${token.name || 'token'}`;
  const name = selectionSize > 1 ? `${selectionSize} selected` : (token.name || 'Token');

  return h('div', { id: 'token-action-bar', class: 'token-action-bar', role: 'toolbar', 'aria-label': label }, [
    h('span', { class: 'token-action-bar__name' }, name),
    ...actions.map((a) => h('button', {
      key: a.id,
      type: 'button',
      class: 'dbt dbt--sm',
      'data-bar-action': a.id,
      onClick: () => a.run(ui),
    }, a.label)),
  ]);
}

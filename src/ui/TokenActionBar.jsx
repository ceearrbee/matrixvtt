/**
 * TokenActionBar.jsx - contextual actions for the selected token,
 * docked at the top of the map region (tldraw pattern). Renders only
 * while a token is selected; every action also exists in the token's
 * right-click menu or the sheet, so the bar is an accelerator, not
 * the only path.
 */

import { h } from 'preact';
import { selectedTokenSignal } from '../state/ui-signals.js';
import { tokensSignal } from '../state/signals.js';
import { buildTokenBarActions } from './token-bar-actions.js';

export function TokenActionBar({ ui }) {
  const selectedId = selectedTokenSignal.value;
  const token = selectedId ? tokensSignal.value?.get?.(selectedId) : null;
  if (!token) return null;

  const isGM = ui.state?.isGM?.() === true;
  const isOwner = token.owner_user_id != null
    && token.owner_user_id === ui.widgetManager?.userId;
  const actions = buildTokenBarActions({ isGM, isOwner, token });

  return h('div', { class: 'token-action-bar', role: 'toolbar', 'aria-label': `Actions for ${token.name || 'token'}` }, [
    h('span', { class: 'token-action-bar__name' }, token.name || 'Token'),
    ...actions.map((a) => h('button', {
      key: a.id,
      type: 'button',
      class: 'dbt dbt--sm',
      'data-bar-action': a.id,
      onClick: () => a.run(ui),
    }, a.label)),
  ]);
}

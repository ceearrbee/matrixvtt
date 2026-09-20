/**
 * Choose which tokens to put on the map currently open.
 *
 * A map switch does not move anybody: tokens belong to a map, and the
 * only thing that moved them between maps was a travel pin. A GM who
 * has just generated a fresh dungeon needs to bring the party and
 * whatever is waiting for them onto it directly.
 */

import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { ENTITY_TYPES } from '../utils/constants.js';
import { bringTokensToMap } from '../map/actions/bring-tokens.js';
import { Avatar } from './Avatar.jsx';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';

function elsewhere(state) {
  const out = [];
  for (const [id, token] of state.tokens ?? []) {
    if (token?.map_id !== state.activeMapId) out.push({ ...token, id });
  }
  return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

function Chooser({ ui, col, row, onClose }) {
  const [chosen, setChosen] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const available = useMemo(() => elsewhere(ui.state), [ui.state]);
  const party = available.filter((t) => t.type === ENTITY_TYPES.PC);
  const others = available.filter((t) => t.type !== ENTITY_TYPES.PC);

  const toggle = (id) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const place = async () => {
    setBusy(true);
    try {
      const moved = await bringTokensToMap(ui.state, [...chosen], { col, row });
      ui.mapRenderer?.render?.();
      ui._toast?.(`Placed ${moved} token${moved === 1 ? '' : 's'} on this map.`, 'success');
      onClose();
    } catch (err) {
      ui._toast?.(`Could not place tokens: ${err?.message || 'unknown error'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return h(Modal, {
    id: 'bring-tokens-modal',
    title: 'Place tokens on this map',
    maxWidth: '460px',
    onClose,
  }, h('div', { class: 'bring-tokens' }, [
    available.length === 0
      ? h('p', { class: 'bring-tokens__empty' },
        'Every token in the campaign is already on this map.')
      : h('div', { class: 'bring-tokens__groups' }, [
        group('Player characters', party, chosen, toggle),
        group('NPCs and monsters', others, chosen, toggle),
      ]),
    h('div', { class: 'form-actions' }, [
      party.length > 0 && h('button', {
        type: 'button', class: 'dbt dbt--sm',
        onClick: () => setChosen(new Set(party.map((t) => t.id))),
      }, 'Select the party'),
      h('button', {
        type: 'button', class: 'dbt btn-primary push-right',
        disabled: busy || chosen.size === 0,
        onClick: place,
      }, chosen.size === 0 ? 'Place' : `Place ${chosen.size}`),
    ]),
  ]));
}

function group(label, tokens, chosen, toggle) {
  if (tokens.length === 0) return null;
  return h('div', { class: 'bring-tokens__group' }, [
    h('p', { class: 'bring-tokens__group-label' }, label),
    h('ul', { class: 'bring-tokens__list' }, tokens.map((token) => h('li', {
      key: token.id,
      class: 'bring-tokens__row',
      'data-bring-token': token.id,
    }, h('label', { class: 'bring-tokens__label' }, [
      h('input', {
        type: 'checkbox',
        checked: chosen.has(token.id),
        onChange: () => toggle(token.id),
      }),
      h(Avatar, { imageUrl: token.image_url, name: token.name, color: token.color, size: 20 }),
      h('span', null, token.name || token.id),
    ])))),
  ]);
}

/**
 * Mount the chooser. `col`/`row` is where the arrivals cluster; omit it
 * and they land in the middle of the map.
 *
 * @param {{ ui: any, col?: number, row?: number }} opts
 */
export function showBringTokensModal({ ui, col, row }) {
  return openModal((close) => h(Chooser, { ui, col, row, onClose: close }));
}

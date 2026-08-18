/**
 * EntityList - Preact replacement for the legacy `renderEntityList`
 * string-HTML path consumed by CharacterSheet.jsx / NPCSheet.jsx.
 *
 * Escape is now structural (Preact text children). Handlers wire
 * directly instead of via event-delegated `data-*` attributes.
 */
import { h } from 'preact';
import { Card } from './Card.jsx';
import { EditIcon, TrashIcon } from './icons/index.jsx';
import { getHPPercentage, getHPColor } from '../utils/ui-helpers.js';
import { ENTITY_TYPES } from '../utils/constants.js';
import { charactersSignal, npcsSignal } from '../state/signals.js';
import { CardOverlays } from './entity-card-overlays.jsx';
import { SrdButton } from './TabToolbar.jsx';

function EntityCard({ ui, entity, id, type }) {
  const isPC = type === ENTITY_TYPES.PC;
  const myUserId = ui.widgetManager?.userId;
  const isClaimed = isPC && (entity.player_user_id === myUserId || entity.claimed_by_user_id === myUserId);
  const canEdit = ui.state.canEditEntity(entity);
  const cardOverlays = ui.state.settings?.systemConfig?.character_card?.overlays;
  const hpPercent = getHPPercentage(entity);
  const hpColor = getHPColor(hpPercent);
  const subText = isPC
    ? `${entity.class_level ?? ''} · ${entity.species ?? ''}`
    : `CR ${entity.cr ?? ''} · ${entity.size_category ?? ''}`;

  // Card click selects the entity into the canonical sidebar sheet
  // (matching PartyRoster), rather than opening a popup that duplicates
  // it. The sheet is the single home for a character/NPC's full detail.
  const select = () => {
    if (isPC) ui.selectCharacterById?.(id);
    else ui.selectNPCById?.(id);
  };
  const edit = (e) => { e.stopPropagation(); isPC ? ui.showEditCharacterForm(id) : ui.showEntityForm(ENTITY_TYPES.NPC, id); };
  const del = (e) => { e.stopPropagation(); isPC ? ui.deleteCharacter(id) : ui.deleteNPC(id); };

  return h(Card, {
    class: `char-card${isClaimed ? ' char-card--claimed' : ''}`,
    onActivate: select,
    ariaLabel: `Select ${entity.name || (isPC ? 'character' : 'NPC')}`,
    extraProps: { [isPC ? 'data-character-card' : 'data-npc-card']: id },
  }, [
    h('div', { class: 'char-card__header' }, [
      h('div', {
        class: 'char-card__avatar',
        style: !isPC ? 'background: var(--color-text-danger);' : undefined,
      }, (entity.name ?? '').substring(0, 2).toUpperCase()),
      h('div', { class: 'char-card__info' }, [
        h('div', { class: 'char-card__name' }, [
          entity.name,
          isClaimed && h('span', { class: 'char-card__claimed-star', 'aria-label': 'Claimed by you' }, ' ★'),
        ]),
        h('div', { class: 'char-card__sub' }, subText),
      ]),
      canEdit && h('button', {
        class: 'dbt dbt--compact', 'aria-label': 'Edit', title: 'Edit', onClick: edit,
      }, h(EditIcon, {})),
      canEdit && h('button', {
        class: 'dbt dbt--compact', 'aria-label': 'Delete', title: 'Delete',
        style: 'color: var(--color-text-danger);', onClick: del,
      }, h(TrashIcon, {})),
    ]),
    cardOverlays
      ? h(CardOverlays, { entity, overlays: cardOverlays })
      : [
          entity.hp_max != null && h('div', {
            class: 'hp-bar', role: 'meter', 'aria-label': 'Hit Points',
            'aria-valuenow': entity.hp_current, 'aria-valuemin': 0, 'aria-valuemax': entity.hp_max,
          }, h('div', { class: 'hp-bar__track' },
              h('div', { class: 'hp-bar__fill', style: `width: ${hpPercent}%; background: ${hpColor};` }))),
          entity.hp_max != null && h('div', { class: 'char-card__hp-label' }, [
            'HP: ',
            h('span', { class: 'hp-bar__value' }, `${entity.hp_current ?? 0} / ${entity.hp_max}`),
            !isPC && entity.ac != null && ` · AC ${entity.ac}`,
          ]),
        ],
  ]);
}

export function EntityList({ ui, type }) {
  const isNPC = type === ENTITY_TYPES.NPC;
  (isNPC ? npcsSignal : charactersSignal).value;
  const entries = isNPC
    ? Array.from(ui.state.npcs.entries())
    : Array.from(ui.state.characters.entries());
  const isGM = ui.state.isGM();

  if (entries.length === 0) {
    return h('div', { class: 'entity-list entity-list--empty' }, [
      h('div', { style: 'text-align:center;color:var(--color-text-tertiary);margin-bottom:12px;' },
        `No ${isNPC ? 'NPCs' : 'characters'} yet`),
      !isNPC && h('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;' }, [
        h('button', {
          class: 'dbt btn-primary', 'data-create-character': true,
          onClick: () => ui.showEntityForm(ENTITY_TYPES.PC),
        }, '+ Create Character'),
        h('button', {
          class: 'dbt', 'data-character-wizard': true,
          onClick: () => ui.showCharacterWizard(),
        }, '🧙 Wizard'),
      ]),
      isNPC && isGM && h('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;' }, [
        h('button', {
          class: 'dbt btn-primary', 'data-add-npc': true,
          onClick: () => ui.showAddNPCForm(),
        }, '+ Add NPC'),
        h(SrdButton, { ui, kind: 'monster', class: 'dbt' }),
      ]),
    ]);
  }

  const sorted = entries.slice().sort((a, b) => (a[1].name ?? '').localeCompare(b[1].name ?? ''));
  return h('div', { class: `char-list${isNPC ? ' char-list--npc' : ''}` }, [
    ...sorted.map(([id, e]) => h(EntityCard, { ui, entity: e, id, type, key: id })),
    isNPC && isGM && h('button', {
      class: 'dbt btn-primary', style: 'width:100%;margin-top:8px;', 'data-add-npc': true,
      onClick: () => ui.showAddNPCForm(),
    }, '+ Add NPC'),
    isNPC && isGM && h(SrdButton, {
      ui, kind: 'monster', label: '📖 Add from SRD',
      class: 'dbt', style: 'width:100%;margin-top:8px;',
    }),
  ]);
}

/**
 * NewEntityMenu - the GM "+ New" create hub. Opens a modal grid of every
 * thing a GM can create; each tile routes to that entity's existing
 * create form, so this is purely a discoverable single entry point on
 * top of the established create flows (the C in the app's CRUD).
 */
import { h } from 'preact';
import { openModal } from './modal-host.js';
import { Modal } from './Modal.jsx';
import { ENTITY_TYPES } from '../utils/constants.js';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { showSceneStartModal } from './SceneStartModal.js';
import {
  PersonIcon, PeopleIcon, BoxIcon, BookIcon, MapsIcon, SceneIcon,
  LongPostIcon, PinIcon, DiceIcon,
} from './icons/index.jsx';

/**
 * Grouped create actions. Each `run` calls an existing ui create flow.
 * @param {any} ui
 */
function groups(ui) {
  return [
    {
      title: 'Actors',
      items: [
        { key: 'character', label: 'Character', Icon: PersonIcon, run: () => ui.showEntityForm(ENTITY_TYPES.PC) },
        { key: 'npc', label: 'NPC', Icon: PeopleIcon, run: () => ui.showEntityForm(ENTITY_TYPES.NPC) },
        { key: 'token', label: 'Token', Icon: PinIcon, run: () => ui.showTokenForm(null) },
      ],
    },
    {
      title: 'Content',
      items: [
        { key: 'item', label: 'Item', Icon: BoxIcon, run: () => ui.showItemForm(null) },
        { key: 'spell', label: 'Spell', Icon: BookIcon, run: () => ui.showSpellForm(null) },
        { key: 'table', label: 'Roll table', Icon: DiceIcon, run: () => ui.showTableForm(null) },
      ],
    },
    {
      title: 'World & story',
      items: [
        { key: 'map', label: 'Map', Icon: MapsIcon, run: () => ui.openMapsPanel() },
        { key: 'scene', label: 'Scene', Icon: SceneIcon, run: () => showSceneStartModal(ui) },
        { key: 'handout', label: 'Handout', Icon: LongPostIcon, run: () => ui.showHandoutForm(null) },
        { key: 'page', label: 'Page', Icon: BookIcon, run: () => ui.showPageForm() },
      ],
    },
  ];
}

export function openNewMenu(ui) {
  openModal((close) =>
    h(Modal, { id: 'new-entity-modal', title: 'Create new', maxWidth: MODAL_WIDTHS.MEDIUM, onClose: close },
      h('div', { class: 'new-menu' },
        groups(ui).map((g) => h('section', { key: g.title, class: 'new-menu__group' }, [
          h('h3', { class: 'new-menu__title' }, g.title),
          h('div', { class: 'new-menu__grid' },
            g.items.map((it) => h('button', {
              key: it.key,
              type: 'button',
              class: 'new-menu__item',
              'data-new': it.key,
              onClick: () => { close(); it.run?.(); },
            }, [
              h('span', { class: 'new-menu__icon', 'aria-hidden': 'true' }, h(it.Icon, {})),
              h('span', { class: 'new-menu__label' }, it.label),
            ]))),
        ]))),
    ),
  );
}

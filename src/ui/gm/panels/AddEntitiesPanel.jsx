import { h } from 'preact';
import { ENTITY_TYPES } from '../../../utils/constants.js';

/** @param {{ ui: any, gm?: any }} props */
export function AddEntitiesPanel(props) {
  const { ui } = props;
  return h(
    'div',
    { class: 'gm-panel gm-panel--add', style: 'padding:12px;' },
    h('div', { class: 'button-group' }, [
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Add new token to map',
          title: 'Add token',
          onClick: () => ui.showTokenForm(null),
        },
        '+ Token'
      ),
      h(
        'button',
        {
          class: 'dbt btn-primary',
          'aria-label': 'Add new character or NPC',
          title: 'Add character/NPC',
          onClick: () => ui.showEntityForm(ENTITY_TYPES.PC),
        },
        '+ Character/NPC'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Add new item to database',
          title: 'Add item',
          onClick: () => ui.showItemForm(null),
        },
        '+ Item'
      ),
    ])
  );
}

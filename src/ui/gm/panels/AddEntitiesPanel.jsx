/**
 * The GM panel's Add tab. It used to declare its own three buttons -
 * token, character/NPC, item - a narrower copy of the header's Create
 * menu that drifted from it. It opens that menu instead.
 */
import { h } from 'preact';
import { openNewMenu } from '../../NewEntityMenu.jsx';
import { PlusIcon } from '../../icons/index.jsx';

/** @param {{ ui: any, gm?: any }} props */
export function AddEntitiesPanel({ ui }) {
  return h('div', { class: 'gm-panel gm-panel--add', style: 'padding:var(--space-xl);' },
    h('button', {
      class: 'dbt btn-primary',
      'aria-label': 'Create a character, NPC, token, item, map, scene or handout',
      title: 'Create new',
      onClick: () => openNewMenu(ui),
    }, [h(PlusIcon, {}), ' Create new']),
  );
}

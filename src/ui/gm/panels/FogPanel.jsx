import { h } from 'preact';
import { fogSignal, activeMapIdSignal } from '../../../state/signals.js';
import { FOG_MODES } from '../../../utils/ui-constants.js';
import { HelpIcon } from '../../HelpIcon.jsx';

/** @param {{ ui?: any, gm: any }} props */
export function FogPanel(props) {
  const { gm } = props;
  const activeId = activeMapIdSignal.value;
  const fog = activeId
    ? (fogSignal.value.get(activeId) ?? { mode: FOG_MODES.HIDDEN })
    : { mode: FOG_MODES.HIDDEN };
  const fogOn = fog.mode === FOG_MODES.HIDDEN;

  return h('div', { class: 'gm-panel gm-panel--fog', style: 'padding:12px;' }, [
    h(
      'div',
      {
        class: 'gm-panel__header',
        style: 'display:flex;align-items:center;gap:6px;margin-bottom:8px;',
      },
      [h('h4', { style: 'margin:0;' }, 'Fog of War'), h(HelpIcon, { term: 'fog' })]
    ),
    h('div', { class: 'button-group' }, [
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': fogOn
            ? 'Turn off fog of war (show map to players)'
            : 'Turn on fog of war (hide map from players)',
          title: fogOn
            ? 'Fog is on - click to clear and show the map'
            : 'Fog is off - click to hide the map',
          onClick: () => gm.toggleFog(),
        },
        fogOn ? '🌫 Fog On' : '☀ Fog Off'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Reveal entire map to players',
          title: 'Reveal all',
          onClick: () => gm.revealAllFog(),
        },
        'Reveal All'
      ),
      h(
        'button',
        {
          class: 'dbt',
          'aria-label': 'Hide entire map with fog',
          title: 'Hide all',
          onClick: () => gm.hideAllFog(),
        },
        'Hide All'
      ),
    ]),
  ]);
}

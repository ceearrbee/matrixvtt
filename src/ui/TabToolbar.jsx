/**
 * TabToolbar - the shared title + action row at the top of a list tab
 * (Items, Spells, entity lists). SrdButton is the gated "add from SRD
 * compendium" action those tabs all offer.
 */
import { h } from 'preact';
import { compendiumAvailable, openCompendiumBrowser } from './compendium/open-browser.js';
import { layoutModeSignal } from '../state/ui-signals.js';
import { LAYOUT_MODES } from '../utils/constants.js';

const SRD_KIND_LABELS = { item: 'items', spell: 'spells', monster: 'monsters' };

export function TabToolbar({ title = undefined, modifier = undefined, children = null }) {
  return h(
    'div',
    { class: `tab-toolbar${modifier ? ` tab-toolbar--${modifier}` : ''}` },
    [title && h('span', { class: 'tab-toolbar__title' }, title), children]
  );
}

export function SrdButton({
  ui,
  kind,
  label = '📖 SRD',
  class: className = 'dbt dbt--sm',
  style = undefined,
}) {
  if (!compendiumAvailable(ui)) return null;
  // Icon layout condenses the toolbar to the glyph; the accessible name
  // stays on aria-label + the title tooltip.
  const iconMode = layoutModeSignal.value === LAYOUT_MODES.ICON;
  return h(
    'button',
    {
      class: className,
      style,
      'data-compendium-open': kind,
      'aria-label': `Add ${SRD_KIND_LABELS[kind] ?? kind} from the SRD compendium`,
      title: 'Add from SRD',
      onClick: () => openCompendiumBrowser(ui, kind),
    },
    iconMode ? '📖' : label
  );
}

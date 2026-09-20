/**
 * Turn a saved map's generated layout into line-of-sight walls.
 *
 * Deliberately a button rather than part of saving the background:
 * walls are real room state with a real cost, and a GM who only wanted
 * a floor should not silently acquire a couple of hundred of them.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';

export function GeneratedWallsButton({ ui, mapConfig, mapId }) {
  const [busy, setBusy] = useState(false);
  if (mapConfig?.background?.kind !== 'generated') return null;
  if (!mapId || mapId === '__new__') return null;

  const apply = async () => {
    setBusy(true);
    try {
      const count = await ui.state.applyGeneratedWalls(mapId);
      ui._toast?.(`Added ${count} walls for line of sight.`, 'success');
    } catch (err) {
      ui._toast?.(`Could not add walls: ${err?.message || 'unknown error'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return h('button', {
    type: 'button',
    class: 'dbt dbt--sm',
    'data-generate-walls': 'true',
    disabled: busy,
    title: 'Derive walls from this layout. Replaces any walls generated here before; walls you drew by hand are kept.',
    'aria-label': 'Add walls for line of sight from this generated layout',
    onClick: apply,
  }, busy ? 'Adding…' : 'Add walls for line of sight');
}

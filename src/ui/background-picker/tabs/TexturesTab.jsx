/**
 * Textures tab: the bundled CC0 terrain tiles, tiled under the grid.
 */

import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { builtinTileUrl } from '../../../utils/builtin-backgrounds.js';

export function TexturesTab({ manifest, error, onChoose, onCredit }) {
  const [material, setMaterial] = useState(null);

  const shown = useMemo(() => {
    const all = manifest?.tiles ?? [];
    return material ? all.filter((t) => t.material === material) : all;
  }, [manifest, material]);

  return h('div', { class: 'bg-picker__pane' }, [
    error && h('p', { class: 'bg-picker__error' }, `Could not load the tile library: ${error}`),
    h('div', { class: 'bg-picker__chips' }, [
      h('button', {
        type: 'button',
        class: `dbt dbt--sm${material === null ? ' is-active' : ''}`,
        'aria-pressed': String(material === null),
        onClick: () => setMaterial(null),
      }, 'All'),
      ...(manifest?.materials ?? []).map((m) => h('button', {
        key: m,
        type: 'button',
        class: `dbt dbt--sm${material === m ? ' is-active' : ''}`,
        'aria-pressed': String(material === m),
        onClick: () => setMaterial(m),
      }, m)),
    ]),
    h('div', { class: 'bg-picker__grid', role: 'list' }, [
      h('button', {
        type: 'button',
        class: 'bg-picker__tile bg-picker__tile--none',
        'data-tile-none': 'true',
        role: 'listitem',
        'aria-label': 'No background, grid only',
        onClick: () => onChoose(null),
      }, 'Grid only'),
      ...shown.map((tile) => h('button', {
        key: tile.id,
        type: 'button',
        class: 'bg-picker__tile',
        'data-tile-id': tile.id,
        role: 'listitem',
        'aria-label': `${tile.label} background`,
        onMouseOver: () => onCredit(tile),
        onFocus: () => onCredit(tile),
        onClick: () => onChoose({ kind: 'tile', tile: tile.id, scale: 1 }),
      }, [
        h('img', { src: builtinTileUrl(tile.id), alt: '', loading: 'lazy', decoding: 'async', width: 96, height: 96 }),
        h('span', { class: 'bg-picker__label' }, tile.label),
      ])),
    ]),
  ]);
}

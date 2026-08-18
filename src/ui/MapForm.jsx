/**
 * MapForm - right-pane editor inside MapsPanel. Submits via the
 * shared `submitMapForm` helper so the form stays DOM-driven (the
 * existing tests poke fields and call submitMapForm directly).
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { autoFitCellSize } from '../utils/image-fit.js';

function LayerFieldset({ layer, index, onRemove }) {
  return h('fieldset', {
    class: 'map-layer-card',
    'data-layer-index': index,
  }, [
    h('input', { type: 'text', class: 'form-input layer-name', placeholder: 'Layer Name', value: layer.name || '' }),
    h('input', { type: 'text', class: 'form-input layer-url', placeholder: 'Image URL', value: layer.image_url || '' }),
    h('div', { class: 'form-row map-layer-card__row' }, [
      h('input', { type: 'number', class: 'form-input layer-opacity', value: layer.opacity ?? 1, min: 0, max: 1, step: 0.1 }),
      h('label', null, [h('input', { type: 'checkbox', class: 'layer-visible', checked: layer.visible !== false }), ' Show']),
      h('label', null, [h('input', { type: 'checkbox', class: 'layer-gm-only', checked: !!layer.gm_only }), ' GM']),
      h('button', { type: 'button', class: 'dbt dbt--compact push-right map-layer-card__delete', onClick: onRemove }, 'Delete'),
    ]),
  ]);
}

export function MapForm({ ui, mapConfig, isNewMode, selectedId, onSaved, submit }) {
  const def = {
    name: mapConfig?.name || (isNewMode ? 'New Map' : 'Untitled'),
    w: mapConfig?.width_cells || 20,
    h: mapConfig?.height_cells || 15,
    px: mapConfig?.cell_px || 40,
    url: mapConfig?.image_url || '',
    grid: mapConfig?.grid_type || 'square',
    tint: mapConfig?.env_tint || '',
  };
  const initialSource = def.url.startsWith('data:') ? 'upload' : (def.url ? 'url' : 'none');
  const [sourceType, setSourceType] = useState(initialSource);
  const [layers, setLayers] = useState((mapConfig?.layers || []).map((l, i) => ({ ...l, _k: i })));

  const onSubmit = async (e) => {
    e.preventDefault();
    const modal = e.currentTarget.closest('.modal-content').parentElement;
    if (await submit(ui, modal, selectedId)) onSaved();
  };

  return h('div', { class: 'map-form-pane' }, h('form', { id: 'map-form', onSubmit }, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'map-name' }, 'Map Name'),
      h('input', { type: 'text', class: 'form-input', id: 'map-name', value: def.name, required: true, autofocus: true }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'map-source-type' }, 'Source'),
      h('select', { class: 'form-select', id: 'map-source-type', onChange: (e) => setSourceType(e.target.value) }, [
        ui.widgetManager?.canUploadMedia && h('option', { value: 'upload', selected: sourceType === 'upload' }, 'Upload File'),
        h('option', { value: 'url', selected: sourceType === 'url' }, 'Image URL'),
        h('option', { value: 'none', selected: sourceType === 'none' }, 'Grid Only'),
      ]),
    ]),
    h('div', { class: 'form-group', id: 'map-upload-group', hidden: sourceType !== 'upload' }, [
      h('input', { type: 'file', class: 'form-input', id: 'map-upload', 'aria-label': 'Map image file', accept: 'image/*' }),
      h('div', { id: 'map-preview' }),
    ]),
    h('div', { id: 'map-url-group', class: 'form-group', hidden: sourceType !== 'url' },
      h('input', { type: 'text', class: 'form-input', id: 'map-url', 'aria-label': 'Map image URL', placeholder: 'Paste a URL or browse the library…', value: def.url })),
    h('div', { class: 'section-header' }, [
      'Layers ',
      h('button', {
        type: 'button', class: 'dbt dbt--sm', id: 'add-layer-btn',
        onClick: () => setLayers(ls => [...ls, { _k: Date.now() }]),
      }, '+ Add'),
    ]),
    h('div', { id: 'map-layers-list' },
      layers.map((l, i) => h(LayerFieldset, {
        key: l._k, layer: l, index: i,
        onRemove: () => setLayers(ls => ls.filter((_, j) => j !== i)),
      }))),
    h('div', { class: 'form-row' }, [
      h('div', { class: 'form-group' }, [h('label', { class: 'form-label', for: 'map-width' }, 'Width'), h('input', { type: 'number', class: 'form-input', id: 'map-width', value: def.w, min: 5 })]),
      h('div', { class: 'form-group' }, [h('label', { class: 'form-label', for: 'map-height' }, 'Height'), h('input', { type: 'number', class: 'form-input', id: 'map-height', value: def.h, min: 5 })]),
      h('div', { class: 'form-group' }, [
        h('label', { class: 'form-label', for: 'map-cell-px' }, 'Cell PX'),
        h('div', { class: 'row-sm' }, [
          h('input', { type: 'number', class: 'form-input flex-1', id: 'map-cell-px', value: def.px, min: 20 }),
          h('button', {
            type: 'button',
            class: 'dbt dbt--sm',
            title: 'Compute cell size from the image width and the column count',
            'aria-label': 'Auto-fit cell size from image dimensions',
            onClick: (e) => autoFitCellSize(e.currentTarget, ui),
          }, '↔ Auto-fit'),
        ]),
      ]),
    ]),
    h('div', { class: 'form-row' }, [
      h('div', { class: 'form-group flex-1' }, [
        h('label', { class: 'form-label', for: 'map-grid-type' }, 'Grid'),
        h('select', { class: 'form-select', id: 'map-grid-type' }, [
          h('option', { value: 'square',     selected: def.grid === 'square'     }, 'Square'),
          h('option', { value: 'hex_pointy', selected: def.grid === 'hex_pointy' }, 'Hex (pointy-top)'),
          h('option', { value: 'hex_flat',   selected: def.grid === 'hex_flat'   }, 'Hex (flat-top)'),
        ]),
      ]),
      h('div', { class: 'form-group flex-1' }, [
        h('label', { class: 'form-label', for: 'map-env-tint' }, 'Lighting'),
        h('select', { class: 'form-select', id: 'map-env-tint' }, [
          h('option', { value: '',           selected: !def.tint               }, 'None'),
          h('option', { value: 'daylight',   selected: def.tint === 'daylight' }, 'Daylight'),
          h('option', { value: 'dawn',       selected: def.tint === 'dawn'     }, 'Dawn'),
          h('option', { value: 'dusk',       selected: def.tint === 'dusk'     }, 'Dusk'),
          h('option', { value: 'night',      selected: def.tint === 'night'    }, 'Night'),
          h('option', { value: 'cave',       selected: def.tint === 'cave'     }, 'Cave'),
          h('option', { value: 'underwater', selected: def.tint === 'underwater' }, 'Underwater'),
          h('option', { value: 'hellscape',  selected: def.tint === 'hellscape'  }, 'Hellscape'),
        ]),
      ]),
    ]),
    h('div', { class: 'form-actions map-form-actions' },
      h('button', { type: 'submit', class: 'dbt btn-primary w-full' }, '✓ Save Map')),
  ]));
}

export function MapFormPanel({ ui, selectedMap, isNewMode, selectedId, onSaved, submit }) {
  if (!ui.state.isGM()) return h('div', { class: 'map-form-empty' }, h('p', null, '👀 View Only'));
  if (!selectedMap && !isNewMode) return h('div', { class: 'map-form-empty' }, h('p', null, 'Select a map to edit'));
  return h('div', null, [
    h('div', { class: 'map-form-header' },
      h('h3', null, isNewMode ? 'Create New Map' : 'Edit Map')),
    h(MapForm, { ui, mapConfig: selectedMap, isNewMode, selectedId, onSaved, submit }),
  ]);
}

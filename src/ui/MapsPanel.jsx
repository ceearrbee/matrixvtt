/**
 * MapsPanel.jsx - Map management modal (orchestrator + GM submit
 * helper). The list and form sub-components live in MapsList.jsx and
 * MapForm.jsx; the cell-size auto-fit helper lives in
 * src/utils/image-fit.js. `submitMapForm` stays a DOM-driven helper
 * used by tests via gm-wiring.js.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import * as v from 'valibot';
import { FormReader, applyFieldErrors } from '../utils/ui-helpers.js';
import { intRange } from '../utils/form-schemas.js';
import { MAP_BOUNDS } from '../utils/schemas/world.js';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { confirm } from './confirm-dialogs.jsx';
import { mapsSignal, activeMapIdSignal } from '../state/signals.js';
import { MapsList } from './MapsList.jsx';
import { MapFormPanel } from './MapForm.jsx';
import { uploadMapImage } from './maps/upload-map-image.js';


function MapsPanelModal({ ui, initialSelectedId, onClose }) {
  // Subscribe to map collection + active-map changes so the list and
  // active highlight update without the prior `tick` re-render hack.
  mapsSignal.value; activeMapIdSignal.value;
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? ui.state.activeMapId);

  const maps = Array.from(ui.state.maps.entries());
  const activeId = ui.state.activeMapId;
  const isGM = ui.state.isGM();
  const isNewMode = selectedId === '__new__';
  const selectedMap = isNewMode ? null : (selectedId ? ui.state.maps.get(selectedId) : null);

  const close = onClose;

  const openMap = async (id) => {
    if (id !== activeId) {
      await ui.state.switchMap(id);
      close();
      ui.updateMapPanel();
    }
  };

  const duplicate = async (id) => {
    const newId = await ui.state.duplicateMap(id);
    setSelectedId(newId);
  };

  const del = (id) => {
    const map = ui.state.maps.get(id);
    const name = map?.name || 'this map';
    const dims = map ? ` (${map.width_cells}×${map.height_cells})` : '';
    confirm(h('span', null, ['Delete map ', h('strong', null, name), dims, '?']), async () => {
      await ui.state.deleteMap(id);
      if (selectedId === id) setSelectedId(ui.state.activeMapId);
    });
  };

  return h(Modal, {
    id: 'maps-panel-modal',
    title: 'Map Management',
    maxWidth: '1200px',
    onClose: close,
  },
    h('div', { style: 'display:flex;min-height:500px;' }, [
        h(MapsList, {
          ui, maps, selectedId, activeId, isGM,
          onSelect: setSelectedId, onOpen: openMap, onDuplicate: duplicate, onDelete: del,
          onNew: () => setSelectedId('__new__'),
        }),
        h('div', { id: 'map-form-panel', style: 'flex:1;display:flex;flex-direction:column;overflow:hidden;' },
          h(MapFormPanel, {
            ui, selectedMap, isNewMode, selectedId,
            onSaved: () => { close(); ui.updateMapPanel(); },
          submit: submitMapForm,
        })),
    ]));
}

export function openMapsPanel(ui, selectedMapId = null) {
  // openModal is single-instance per overlay id, so a stale panel left
  // by a render that errored mid-way closes through its own disposer.
  openModal((close) => h(MapsPanelModal, { ui, initialSelectedId: selectedMapId, onClose: close }));
}

const MAP_FIELDS = Object.freeze({
  name: 'map-name',
  width_cells: { id: 'map-width', type: 'int' },
  height_cells: { id: 'map-height', type: 'int' },
  cell_px: { id: 'map-cell-px', type: 'int' },
  grid_type: { id: 'map-grid-type' },
  env_tint: { id: 'map-env-tint' },
});

/**
 * A map's size is required and bounded, and the bounds are the room
 * schema's own so the two cannot drift. A cleared Width used to arrive
 * as getInt's 0 and be written as a map zero cells across, because the
 * writer does not validate on the way out - `validateMap` is only wired
 * to incoming events.
 */
export function mapFormSchema() {
  const { cells, cellPx } = MAP_BOUNDS;
  return v.object({
    width_cells: intRange('Map width', cells.min, cells.max, { required: true }),
    height_cells: intRange('Map height', cells.min, cells.max, { required: true }),
    cell_px: intRange('Cell size', cellPx.min, cellPx.max, { required: true }),
  });
}

export async function submitMapForm(ui, modal, selectedId) {
  const $ = (sel) => modal.querySelector(sel);
  const form = new FormReader(modal);
  const layers = Array.from(modal.querySelectorAll('fieldset')).map(fs => ({
    id: `layer-${Math.random().toString(36).substr(2, 5)}`,
    name: fs.querySelector('.layer-name')?.value || 'Layer',
    image_url: fs.querySelector('.layer-url')?.value,
    opacity: parseFloat(fs.querySelector('.layer-opacity')?.value),
    visible: fs.querySelector('.layer-visible')?.checked,
    gm_only: fs.querySelector('.layer-gm-only')?.checked,
  })).filter(l => l.image_url);

  const { values: data, errors } = form.validate(MAP_FIELDS, mapFormSchema());
  if (Object.keys(errors).length > 0) {
    applyFieldErrors(modal, errors, MAP_FIELDS);
    return false;
  }

  let imageUrl = $('#map-url')?.value || null;
  if ($('#map-source-type')?.value === 'upload') {
    const file = $('#map-upload')?.files?.[0];
    if (file) {
      try {
        imageUrl = await uploadMapImage(ui, file);
        if (!imageUrl) return false;
      } catch (err) {
        ui._toast('Upload failed: ' + err.message, 'error');
        return false;
      }
    }
  }

  const mapConfig = { ...data, image_url: imageUrl, layers, offset_x: 0, offset_y: 0 };
  try {
    if (!selectedId || selectedId === '__new__') await ui.state.createMap(mapConfig);
    else await ui.state.updateMap(selectedId, mapConfig);
    return true;
  } catch (err) { ui._toast('Save failed: ' + err.message, 'error'); return false; }
}


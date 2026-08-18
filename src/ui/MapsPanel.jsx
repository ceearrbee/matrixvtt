/**
 * MapsPanel.jsx - Map management modal (orchestrator + GM submit
 * helper). The list and form sub-components live in MapsList.jsx and
 * MapForm.jsx; the cell-size auto-fit helper lives in
 * src/utils/image-fit.js. `submitMapForm` stays a DOM-driven helper
 * used by tests via gm-wiring.js.
 */

import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import { FormReader, trapFocusIn } from '../utils/ui-helpers.js';
import { confirm, confirmAsync } from './confirm-dialogs.jsx';
import { resizeImageBlob } from '../utils/image-resize.js';
import { mapsSignal, activeMapIdSignal } from '../state/signals.js';
import { MapsList } from './MapsList.jsx';
import { MapFormPanel } from './MapForm.jsx';

const DEFAULT_MAX_MAP_DIM = 2048;
const DEFAULT_RESIZE_QUALITY = 0.9;

function MapsPanelModal({ ui, initialSelectedId, onClose, trigger }) {
  // Subscribe to map collection + active-map changes so the list and
  // active highlight update without the prior `tick` re-render hack.
  mapsSignal.value; activeMapIdSignal.value;
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? ui.state.activeMapId);

  const maps = Array.from(ui.state.maps.entries());
  const activeId = ui.state.activeMapId;
  const isGM = ui.state.isGM();
  const isNewMode = selectedId === '__new__';
  const selectedMap = isNewMode ? null : (selectedId ? ui.state.maps.get(selectedId) : null);

  const close = () => { onClose(); trigger?.focus(); };

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

  return h('div', {
    class: 'modal-content', role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': 'maps-panel-title', style: 'max-width:1200px;width:90vw;',
  }, [
    h('div', { class: 'modal-header' }, [
      h('h2', { id: 'maps-panel-title' }, 'Map Management'),
      h('button', { class: 'modal-close', 'aria-label': 'Close', onClick: close }, '✕'),
    ]),
    h('div', { class: 'modal-body', style: 'padding:0;' },
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
      ])),
  ]);
}

export function openMapsPanel(ui, selectedMapId = null) {
  // Clean up any stale overlay (e.g. from a prior render that errored mid-way)
  // so subsequent clicks aren't silently swallowed by the guard. This is a
  // Preact-rendered custom overlay (not a ModalFactory modal).
  // eslint-disable-next-line vtt/no-direct-modal-remove
  document.getElementById('maps-panel-modal')?.remove();
  const trigger = document.activeElement;
  const overlay = document.createElement('div');
  overlay.id = 'maps-panel-modal';
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);
  const onClose = () => overlay.remove();
  render(h(MapsPanelModal, { ui, initialSelectedId: selectedMapId, onClose, trigger }), overlay);
  trapFocusIn(overlay);
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

  const data = form.collect({
    name: 'map-name',
    width_cells: { id: 'map-width', type: 'int' },
    height_cells: { id: 'map-height', type: 'int' },
    cell_px: { id: 'map-cell-px', type: 'int' },
    grid_type: { id: 'map-grid-type' },
    env_tint:  { id: 'map-env-tint' },
  });

  let imageUrl = $('#map-url')?.value || null;
  if ($('#map-source-type')?.value === 'upload') {
    const file = $('#map-upload')?.files?.[0];
    if (file) {
      try {
        imageUrl = await _uploadMapImage(ui, file);
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

/**
 * Upload a map image with three layers of robustness:
 *  1. Pre-shrink to `max_map_dim` (default 2048 px on the longer
 *     edge) so the request fits the homeserver's per-upload cap.
 *  2. If the homeserver still 413s with `M_TOO_LARGE`, ask the GM
 *     whether to retry at half the previous max-dim and re-attempt.
 *  3. On second failure, suggest the URL field as an external
 *     image-host fallback.
 *
 * Returns the resulting `mxc://` URL on success, or `null` if the
 * GM declined the retry / a fatal error was already toasted.
 */
async function _uploadMapImage(ui, file) {
  const settings = ui.state?.settings ?? {};
  const initialMax = Number(settings.max_map_dim) > 0
    ? Number(settings.max_map_dim)
    : DEFAULT_MAX_MAP_DIM;
  return _resizeAndUpload(ui, file, initialMax, /* retried */ false);
}

async function _resizeAndUpload(ui, file, maxDim, retried) {
  let resized;
  try {
    resized = await resizeImageBlob(file, maxDim, DEFAULT_RESIZE_QUALITY);
  } catch (err) {
    // Resize failure → fall back to raw upload; the user still gets
    // a chance even if the encoder choked on a weird format.
    ui._toast?.(`Couldn't resize image, uploading as-is: ${err.message}`, 'info');
    resized = file;
  }
  try {
    return await ui.widgetManager.uploadMedia(resized);
  } catch (err) {
    if (retried || !_isTooLarge(err)) throw err;
    return _retryAtSmallerCap(ui, file, maxDim);
  }
}

function _isTooLarge(err) {
  if (!err) return false;
  return err.errcode === 'M_TOO_LARGE'
      || err.status === 413
      || err.httpStatus === 413
      || /too large|413/i.test(err.message || '');
}

function _retryAtSmallerCap(ui, file, prevMax) {
  return new Promise((resolve) => {
    const next = Math.max(512, Math.round(prevMax / 2));
    confirmAsync(
      `Image still too large for this homeserver after resizing to ${prevMax} px. ` +
      `Retry at ${next} px?`,
      async () => {
        const url = await _resizeAndUpload(ui, file, next, /* retried */ true);
        resolve(url);
      },
      {
        title: 'Image too large', confirmText: `Retry @ ${next}px`, busyText: 'Retrying…',
        // If the user dismisses without retrying, the caller would otherwise
        // hang waiting on this promise - resolve null so it falls back to the
        // external-URL path.
        onCancel: () => {
          ui._toast?.(
            'Map upload cancelled. You can paste an external image URL instead - see the URL field above.',
            'info',
          );
          resolve(null);
        },
      },
    );
  });
}

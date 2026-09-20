/**
 * The map form's background source picker: upload, external URL,
 * built-in background, or grid only.
 *
 * Split out of MapForm because the background option brought a picker
 * launcher, a summary row, and a hidden field to carry the descriptor
 * through the DOM-driven submit path.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { describeBackground } from '../../map/background-source.js';
import { showBackgroundPicker } from '../background-picker/BackgroundPickerModal.jsx';
import { GeneratedWallsButton } from './GeneratedWallsButton.jsx';

function initialSourceType(mapConfig) {
  if (mapConfig?.background) return 'background';
  const url = mapConfig?.image_url || '';
  if (url.startsWith('data:')) return 'upload';
  return url ? 'url' : 'none';
}

/**
 * What the picker's answer means for the form. An uploaded image is a
 * layer image, so it belongs in the URL field; a tile or a generated
 * layout is a painted fill, so it belongs in the descriptor.
 */
function chooseFrom(descriptor) {
  if (!descriptor) return { sourceType: 'none', imageUrl: null, background: null };
  if (descriptor.kind === 'image') {
    return { sourceType: 'url', imageUrl: descriptor.image_url, background: null };
  }
  return { sourceType: 'background', imageUrl: null, background: descriptor };
}

// Test-only alias: the branch above is worth pinning without a modal.
export const _chooseForTest = chooseFrom;

export function SourceField({ ui, mapConfig, url, mapSize, mapId }) {
  const [sourceType, setSourceType] = useState(initialSourceType(mapConfig));
  const [background, setBackground] = useState(mapConfig?.background ?? null);
  const [imageUrl, setImageUrl] = useState(url);

  const browse = () => showBackgroundPicker({
    mapSize,
    onSelect: (descriptor) => {
      const next = chooseFrom(descriptor);
      setBackground(next.background);
      if (next.imageUrl !== null) setImageUrl(next.imageUrl);
      setSourceType(next.sourceType);
    },
  });

  return h('div', null, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'map-source-type' }, 'Source'),
      h('select', {
        class: 'form-select', id: 'map-source-type',
        onChange: (e) => setSourceType(e.target.value),
      }, [
        h('option', { value: 'background', selected: sourceType === 'background' }, 'Built-in background'),
        ui.widgetManager?.canUploadMedia && h('option', { value: 'upload', selected: sourceType === 'upload' }, 'Upload File'),
        h('option', { value: 'url', selected: sourceType === 'url' }, 'Image URL'),
        h('option', { value: 'none', selected: sourceType === 'none' }, 'Grid Only'),
      ]),
    ]),
    h('input', { type: 'hidden', id: 'map-background', value: background ? JSON.stringify(background) : '' }),
    h('div', { class: 'form-group', id: 'map-background-group', hidden: sourceType !== 'background' }, [
      h('div', { class: 'row-sm' }, [
        h('span', { class: 'map-background-summary flex-1' }, describeBackground(background)),
        h('button', {
          type: 'button', class: 'dbt dbt--sm',
          'aria-label': 'Browse the built-in background library',
          onClick: browse,
        }, 'Choose…'),
      ]),
      h(GeneratedWallsButton, { ui, mapConfig, mapId }),
    ]),
    h('div', { class: 'form-group', id: 'map-upload-group', hidden: sourceType !== 'upload' }, [
      h('input', { type: 'file', class: 'form-input', id: 'map-upload', 'aria-label': 'Map image file', accept: 'image/*' }),
      h('div', { id: 'map-preview' }),
    ]),
    h('div', { id: 'map-url-group', class: 'form-group', hidden: sourceType !== 'url' },
      h('div', { class: 'row-sm' }, [
        h('input', {
          type: 'text', class: 'form-input flex-1', id: 'map-url', 'aria-label': 'Map image URL',
          placeholder: 'Paste a URL or browse the library…', value: imageUrl,
          onInput: (e) => setImageUrl(e.target.value),
        }),
        h('button', {
          type: 'button', class: 'dbt dbt--sm',
          'aria-label': 'Browse the built-in background library',
          onClick: browse,
        }, 'Browse…'),
      ])),
  ]);
}

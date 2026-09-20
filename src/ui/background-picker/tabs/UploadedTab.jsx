/**
 * Uploaded tab: the images already uploaded into this room, so a
 * battlemap is uploaded once and reusable on every map afterwards.
 *
 * Shows references, not copies: picking one hands back the same
 * `mxc://` the original upload produced.
 */

import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { assetsSignal } from '../../../state/signals.js';
import { mediaSrc } from '../../../utils/media-src.js';

export function UploadedTab({ onChoose }) {
  const assets = assetsSignal.value;

  const newestFirst = useMemo(
    () => [...assets.values()].sort((a, b) => (b?.ts ?? 0) - (a?.ts ?? 0)),
    [assets],
  );

  if (newestFirst.length === 0) {
    return h('div', { class: 'bg-picker__pane' },
      h('p', { class: 'bg-picker__empty' },
        'Nothing uploaded to this room yet. Upload a map or a portrait once and it will be reusable here.'));
  }

  return h('div', { class: 'bg-picker__pane' },
    h('div', { class: 'bg-picker__grid', role: 'list' }, newestFirst.map((asset) => h('button', {
      key: asset.id,
      type: 'button',
      class: 'bg-picker__tile',
      'data-asset-id': asset.id,
      role: 'listitem',
      'aria-label': `Use ${asset.name || 'this upload'} as the background`,
      onClick: () => onChoose({ kind: 'image', image_url: asset.mxc }),
    }, [
      h('img', {
        src: mediaSrc(asset.mxc), alt: '', loading: 'lazy', decoding: 'async', width: 96, height: 96,
      }),
      h('span', { class: 'bg-picker__label' }, asset.name || asset.id),
    ]))));
}

/**
 * BackgroundPickerModal - browser for the built-in map backgrounds.
 *
 * Mounted imperatively via `showBackgroundPicker({ onSelect, mapSize })`.
 * `onSelect` receives a background descriptor, or `null` for "no
 * background", and the modal closes. Cancelling calls nothing.
 *
 * Unlike `showIconPicker` this is not a give-me-a-URL widget: a
 * background is a descriptor the renderer paints from, which is what
 * lets a map carry one without anybody uploading an image.
 */

import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadBackgroundManifest } from '../../utils/builtin-backgrounds.js';
import { Modal } from '../Modal.jsx';
import { openModal } from '../modal-host.js';
import { TexturesTab } from './tabs/TexturesTab.jsx';
import { GenerateTab } from './tabs/GenerateTab.jsx';
import { UploadedTab } from './tabs/UploadedTab.jsx';

const TABS = [
  { id: 'textures', label: 'Textures' },
  { id: 'generate', label: 'Generate' },
  { id: 'uploaded', label: 'Uploaded' },
];

function paneFor(tab, { manifest, error, mapSize, choose, setCredited }) {
  if (tab === 'generate') return h(GenerateTab, { mapSize, onChoose: choose });
  if (tab === 'uploaded') return h(UploadedTab, { onChoose: choose });
  return h(TexturesTab, { manifest, error, onChoose: choose, onCredit: setCredited });
}

/** Only the textures grid has per-tile credits to hover. */
function creditLine(tab, credited) {
  if (credited) return `${credited.title} by ${credited.author}`;
  if (tab === 'textures') return 'Hover or focus a tile to see where it came from.';
  if (tab === 'uploaded') return 'Uploaded to this room. Nothing here is re-uploaded when you pick it.';
  return 'Generated layouts are painted with the same tiles.';
}

function Picker({ mapSize, onSelect, onClose }) {
  const [tab, setTab] = useState('textures');
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);
  const [credited, setCredited] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadBackgroundManifest()
      .then((m) => { if (!cancelled) setManifest(m); })
      .catch((err) => { if (!cancelled) setError(err?.message || String(err)); });
    return () => { cancelled = true; };
  }, []);

  const choose = (descriptor) => { onSelect?.(descriptor); onClose(); };

  return h(Modal, {
    id: 'background-picker-modal',
    title: 'Choose a background',
    maxWidth: '760px',
    onClose,
  }, h('div', { class: 'bg-picker' }, [
    h('div', { class: 'bg-picker__tabs', role: 'tablist' }, TABS.map((t) => h('button', {
      key: t.id,
      type: 'button',
      role: 'tab',
      'data-tab': t.id,
      'aria-selected': String(tab === t.id),
      class: `bg-picker__tab${tab === t.id ? ' is-active' : ''}`,
      onClick: () => { setTab(t.id); setCredited(null); },
    }, t.label))),

    paneFor(tab, { manifest, error, mapSize, choose, setCredited }),

    h('div', { class: 'bg-picker__footer' }, [
      h('div', { class: 'bg-picker__credit', 'aria-live': 'polite' },
        creditLine(tab, credited)),
      h('div', { class: 'bg-picker__attribution' }, [
        'Tiles from ',
        h('a', { href: 'https://ambientcg.com', target: '_blank', rel: 'noopener' }, 'ambientCG'),
        ' - CC0 1.0, public domain. Generated layouts are original.',
      ]),
    ]),
  ]));
}

/**
 * Mount the picker. Returns a `close()` function. `onSelect` receives a
 * background descriptor or `null`; it is not called if the user
 * dismisses the modal. `mapSize` shapes the generate preview.
 *
 * @param {{ onSelect?: (descriptor: object|null) => void, mapSize?: object }} [opts]
 */
export function showBackgroundPicker(opts = {}) {
  const { onSelect, mapSize } = opts;
  return openModal((close) => h(Picker, { mapSize, onSelect, onClose: close }));
}

/**
 * Avatar.jsx - circular portrait with monogram fallback.
 *
 * Used wherever the UI shows a person (chat group header, initiative
 * strip, initiative details, party roster, NPC drawer rows).
 * Builds on the existing `image_url` field validated by
 * `src/utils/schemas/helpers.js:validateImageUrlField`.
 *
 * Props:
 *   - imageUrl: optional URL (mxc, https, built-in icon)
 *   - name: display name; first letters drive the monogram fallback
 *   - color: optional hex/css color used as the monogram background;
 *           falls back to a stable hash-derived HSL hue
 *   - size: pixel diameter (default 32)
 */

import { h } from 'preact';

function _hueFromName(name) {
  if (!name) return 200;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return hash % 360;
}

function _monogramFor(name) {
  if (!name || typeof name !== 'string') return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ imageUrl = null, name = '', color = null, size = 32 }) {
  const dim = `${size}px`;
  if (imageUrl) {
    return h('span', {
      class: 'avatar',
      'data-size': String(size),
      style: `width:${dim};height:${dim}`,
    }, h('img', {
      class: 'avatar__img',
      src: imageUrl,
      alt: name || '',
      width: size,
      height: size,
      loading: 'lazy',
    }));
  }
  const bg = color || `hsl(${_hueFromName(name)}, 55%, 45%)`;
  return h('span', {
    class: 'avatar',
    role: 'img',
    'data-size': String(size),
    style: `width:${dim};height:${dim}`,
    'aria-label': name || '',
  }, h('span', {
    class: 'avatar__monogram',
    style: `background:${bg}`,
    'aria-hidden': 'true',
  }, _monogramFor(name)));
}

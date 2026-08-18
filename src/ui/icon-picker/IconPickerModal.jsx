/**
 * IconPickerModal - browser for the built-in game-icons.net library.
 *
 * Mounted imperatively via `showIconPicker({ theme, onSelect })`.
 * Selection invokes `onSelect(url)` with the resolved static URL and
 * closes the modal. Cancellation closes without invoking onSelect.
 *
 * The picker is a generic "give me a URL" widget - it does not know
 * what entity it's selecting for.
 */

import { h, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  builtinIconUrl,
  loadIconManifest,
  searchIcons,
} from '../../utils/builtin-icons.js';
import { trapFocusIn } from '../../utils/ui-helpers.js';
import { themeSignal } from '../../state/ui-signals.js';

const PAGE_SIZE = 240;

function readPreferredTheme() {
  // Pick icons that contrast with the user's effective background.
  // Explicit light/dark themes are easy. For 'auto' fall back to the
  // OS preference via prefers-color-scheme. high-contrast and
  // nondescript lean dark, so they pair with light icons.
  const t = themeSignal.value;
  if (t === 'light') return 'dark';
  if (t === 'dark' || t === 'high-contrast' || t === 'nondescript') return 'light';
  // 'auto' or unknown: probe the OS preference.
  try {
    if (typeof matchMedia === 'function'
        && matchMedia('(prefers-color-scheme: light)').matches) {
      return 'dark';
    }
  } catch { /* matchMedia not available in some test envs */ }
  return 'light';
}

function Picker({ initialTheme, onSelect, onClose }) {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [theme, setTheme] = useState(initialTheme);
  const [hovered, setHovered] = useState(null);
  const [page, setPage] = useState(0);
  const searchRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadIconManifest()
      .then((m) => { if (!cancelled) setManifest(m); })
      .catch((err) => { if (!cancelled) setError(err?.message || String(err)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setPage(0); }, [query, category]);

  const results = useMemo(() => {
    if (!manifest) return [];
    return searchIcons(manifest, query, { category, limit: 5000 });
  }, [manifest, query, category]);

  const visible = results.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = visible.length < results.length;

  const pickIcon = (icon) => {
    const url = builtinIconUrl(icon.id, theme);
    onSelect?.(url, icon);
    onClose();
  };

  const hoveredIcon = hovered
    ? results.find((i) => i.id === hovered)
    : null;

  const totalCount = manifest?.icons?.length ?? 0;

  return h('div', {
    class: 'modal-overlay',
    id: 'icon-picker-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'icon-picker-title',
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
    onKeyDown: (e) => { if (e.key === 'Escape') onClose(); },
  },
    h('div', { class: 'modal-content icon-picker', style: 'max-width:900px;width:90vw;height:80vh;display:flex;flex-direction:column;' }, [
      h('div', { class: 'icon-picker__header' }, [
        h('h2', { id: 'icon-picker-title', class: 'modal-title' }, 'Pick an icon'),
        h('div', { class: 'icon-picker__header-actions' }, [
          h('button', {
            type: 'button',
            class: 'dbt dbt--sm',
            role: 'switch',
            'aria-checked': String(theme === 'light'),
            'aria-label': `Switch to ${theme === 'dark' ? 'light' : 'dark'} icons`,
            onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
          }, theme === 'dark' ? 'Dark icons' : 'Light icons'),
          h('button', {
            type: 'button',
            class: 'dbt dbt--sm modal-close',
            'aria-label': 'Close',
            onClick: onClose,
          }, '×'),
        ]),
      ]),
      h('div', { class: 'icon-picker__controls' }, [
        h('label', { class: 'sr-only', for: 'icon-picker-search' },
          `Search ${totalCount} icons`),
        h('input', {
          ref: searchRef,
          id: 'icon-picker-search',
          type: 'search',
          class: 'form-input',
          placeholder: `Search ${totalCount.toLocaleString()} icons…`,
          value: query,
          autocomplete: 'off',
          onInput: (e) => setQuery(e.currentTarget.value),
        }),
        h('div', { class: 'icon-picker__chips', role: 'group', 'aria-label': 'Category filters' }, [
          h('button', {
            type: 'button',
            class: `dbt dbt--sm${category === null ? ' is-active' : ''}`,
            'aria-pressed': String(category === null),
            onClick: () => setCategory(null),
          }, 'All'),
          ...(manifest?.categories ?? []).map((c) => h('button', {
            key: c.key,
            type: 'button',
            class: `dbt dbt--sm${category === c.key ? ' is-active' : ''}`,
            'aria-pressed': String(category === c.key),
            disabled: c.count === 0,
            onClick: () => setCategory(c.key),
          }, `${c.label} (${c.count})`)),
        ]),
      ]),
      h('div', { class: 'icon-picker__grid-wrap', 'data-icon-theme': theme }, [
        !manifest && !error && h('div', { class: 'icon-picker__loading' }, 'Loading icon library…'),
        error && h('div', { class: 'icon-picker__error' }, `Failed to load icons: ${error}`),
        manifest && results.length === 0 && h('div', { class: 'icon-picker__empty' }, [
          h('p', null, `No icons match "${query}".`),
          category && h('button', {
            type: 'button',
            class: 'dbt dbt--sm',
            onClick: () => setCategory(null),
          }, 'Clear category filter'),
        ]),
        manifest && results.length > 0 && h('div', {
          class: 'icon-picker__grid',
          role: 'listbox',
          'aria-label': 'Icons',
        }, visible.map((icon) => h('button', {
          key: icon.id,
          type: 'button',
          class: 'icon-picker__tile',
          role: 'option',
          'aria-label': `${icon.name} by ${icon.author}`,
          title: `${icon.name} - ${icon.author}`,
          'data-id': icon.id,
          onMouseEnter: () => setHovered(icon.id),
          onFocus: () => setHovered(icon.id),
          onClick: () => pickIcon(icon),
        }, h('img', {
          src: builtinIconUrl(icon.id, theme),
          alt: '',
          loading: 'lazy',
          decoding: 'async',
          width: 48,
          height: 48,
        })))),
        hasMore && h('div', { class: 'icon-picker__more' }, [
          h('button', {
            type: 'button',
            class: 'dbt dbt--sm',
            onClick: () => setPage(page + 1),
          }, `Show more (${results.length - visible.length} remaining)`),
        ]),
      ]),
      h('div', { class: 'icon-picker__footer' }, [
        h('div', { class: 'icon-picker__credit', 'aria-live': 'polite' },
          hoveredIcon
            ? `“${hoveredIcon.name}” by ${hoveredIcon.author}`
            : 'Hover an icon to see its title and author.'),
        h('div', { class: 'icon-picker__attribution' }, [
          'Icons from ',
          h('a', { href: 'https://game-icons.net', target: '_blank', rel: 'noopener' }, 'game-icons.net'),
          ' - CC-BY 3.0',
        ]),
      ]),
    ]),
  );
}

/**
 * Mount the picker. Returns a `close()` function. `onSelect` receives
 * the resolved static URL plus the icon record. If the user dismisses
 * without picking, `onSelect` is not called.
 *
 * @param {{ theme?: 'dark' | 'light', onSelect?: (url: string, icon: any) => void }} [opts]
 */
export function showIconPicker(opts = {}) {
  const { theme, onSelect } = opts;
  const trigger = /** @type {HTMLElement|null} */ (document.activeElement);
  const host = document.createElement('div');
  document.body.appendChild(host);

  const close = () => {
    render(null, host);
    host.remove();
    trigger?.focus?.();
  };

  const initialTheme = theme || readPreferredTheme();
  render(h(Picker, { initialTheme, onSelect, onClose: close }), host);

  const overlay = /** @type {HTMLElement} */ (host.querySelector('.modal-overlay'));
  if (overlay) {
    trapFocusIn(overlay);
    /** @type {HTMLElement|null} */ (overlay.querySelector('input[type="search"]'))?.focus();
  }

  return close;
}

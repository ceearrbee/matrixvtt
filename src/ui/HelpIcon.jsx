import { h, options } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { HELP_TERMS } from './help-terms.js';
import { docsHref } from '../utils/docs-link.js';
import { trapFocusIn } from './modal-focus.js';

export function HelpIcon({ term, label = '' }) {
  const entry = HELP_TERMS[term];
  if (!entry) return null;
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current = /** @type {HTMLElement|null} */ (document.activeElement);

    const popover = containerRef.current?.querySelector('.help-popover');
    const cleanupTrap = popover ? trapFocusIn(popover) : undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
      cleanupTrap?.();
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch { /* ignore */ }
      }
    };
  }, [open]);

  const ariaLabel = label || `Help: ${term}`;
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const prevDebounce = options.debounceRendering;
    options.debounceRendering = (fn) => fn();
    try {
      setOpen((v) => !v);
    } finally {
      options.debounceRendering = prevDebounce;
    }
  };

  return h('span', { ref: containerRef, class: 'help-icon-wrapper', style: 'position:relative;display:inline-flex;' }, [
    h('button', {
      type: 'button',
      class: 'help-icon',
      'aria-label': ariaLabel,
      'aria-haspopup': 'dialog',
      'aria-expanded': String(open),
      title: entry.short,
      onClick,
    }, 'ⓘ'),
    open && h('div', {
      class: 'help-popover modal-overlay',
      role: 'dialog',
      'aria-label': entry.title,
      'aria-labelledby': `help-modal-${term}-title`,
    }, [
      h('div', { class: 'help-popover__header' }, [
        h('strong', {
          id: `help-modal-${term}-title`,
          class: 'help-popover__title',
        }, entry.title),
        h('button', {
          type: 'button',
          class: 'help-popover__close',
          'aria-label': 'Close',
          title: 'Close',
          onClick: (e) => {
            e.stopPropagation();
            setOpen(false);
          },
        }, '×'),
      ]),
      h('p', { class: 'help-popover__body' }, entry.long),
      entry.docPath && h('p', null,
        h('a', { href: docsHref(entry.docPath), target: '_blank', rel: 'noopener' }, 'More in the docs')),
    ]),
  ]);
}

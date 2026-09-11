import { h } from 'preact';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { HELP_TERMS } from './help-terms.js';
import { docsHref } from '../utils/docs-link.js';

export function HelpIcon({ term, label = '' }) {
  const entry = HELP_TERMS[term];
  if (!entry) return null;
  const ariaLabel = label || `Help: ${term}`;
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal((close) =>
      h(Modal, {
        id: `help-modal-${term}`,
        title: entry.title,
        maxWidth: '480px',
        onClose: close,
      }, [
        h('p', null, entry.long),
        entry.docPath && h('p', null,
          h('a', { href: docsHref(entry.docPath), target: '_blank', rel: 'noopener' }, 'More in the docs')),
        h('div', { class: 'form-actions' },
          h('button', { type: 'button', class: 'dbt', 'data-modal-close': true }, 'Close')),
      ]),
    );
  };
  return h('button', {
    type: 'button',
    class: 'help-icon',
    'aria-label': ariaLabel,
    title: entry.short,
    onClick,
  }, 'ⓘ');
}

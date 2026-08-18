import { h } from 'preact';
import { useState } from 'preact/hooks';
import { showIconPicker } from '../icon-picker/IconPickerModal.jsx';

export function PortraitField({ initial = '' }) {
  const [url, setUrl] = useState(initial || '');

  const onBrowse = () => {
    showIconPicker({
      onSelect: (picked) => setUrl(picked),
    });
  };

  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: 'entity-image-url' }, 'Portrait'),
    h('div', { style: 'display:flex;gap:8px;align-items:center;' }, [
      h('div', {
        style: 'width:48px;height:48px;border-radius:50%;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);display:flex;align-items:center;justify-content:center;flex-shrink:0;',
      }, url
        ? h('img', { src: url, alt: '', style: 'width:100%;height:100%;border-radius:50%;object-fit:contain;' })
        : h('span', { style: 'font-size:var(--font-size-xs);color:var(--color-text-tertiary);' }, 'None')),
      h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;' }, [
        h('button', {
          type: 'button',
          class: 'dbt dbt--sm',
          onClick: onBrowse,
        }, '🗃 Browse library'),
        url && h('button', {
          type: 'button',
          class: 'dbt dbt--sm dbt--ghost',
          onClick: () => setUrl(''),
        }, 'Remove'),
      ]),
    ]),
    h('input', {
      type: 'text',
      id: 'entity-image-url',
      class: 'form-input',
      placeholder: 'Or paste an image URL…',
      value: url,
      style: 'margin-top:8px;',
      onInput: (e) => setUrl(e.currentTarget.value),
    }),
  ]);
}

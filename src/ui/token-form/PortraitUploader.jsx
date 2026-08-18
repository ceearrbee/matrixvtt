/**
 * Portrait section of the TokenFormModal: preview + remove button,
 * homeserver upload (when available), and a fallback URL input. The
 * upload state and URL value live in the parent so submit can read
 * them; this component only handles the UI.
 */
import { h } from 'preact';
import { showIconPicker } from '../icon-picker/IconPickerModal.jsx';

export function PortraitUploader({ ui, portraitUrl, setPortraitUrl, uploading, onPortraitFile }) {
  const openLibrary = () => {
    showIconPicker({
      onSelect: (url) => setPortraitUrl(url),
    });
  };

  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label', for: 'token-image-upload' }, 'Portrait (optional)'),
    portraitUrl && h('div', { class: 'token-portrait-preview', style: 'display:flex;align-items:center;gap:10px;margin-bottom:8px;' }, [
      h('img', {
        src: portraitUrl, alt: 'Portrait preview',
        style: 'width:48px;height:48px;border-radius:50%;object-fit:contain;background:var(--color-background-secondary);border:1px solid var(--color-border-secondary);padding:4px;',
      }),
      h('button', {
        type: 'button', class: 'dbt dbt--sm',
        onClick: () => setPortraitUrl(''),
      }, 'Remove portrait'),
    ]),
    h('div', { style: 'display:flex;gap:6px;align-items:center;margin-bottom:6px;' }, [
      h('button', {
        type: 'button',
        class: 'dbt dbt--sm',
        onClick: openLibrary,
      }, '🗃 Browse icon library'),
    ]),
    ui.widgetManager?.canUploadMedia && h('div', { style: 'display:flex;gap:6px;align-items:center;' }, [
      h('input', {
        type: 'file', accept: 'image/*', id: 'token-image-upload',
        disabled: uploading,
        onChange: onPortraitFile,
        style: 'flex:1;',
      }),
      uploading && h('span', { class: 'token-portrait-uploading', style: 'font-size:var(--font-size-xs);color:var(--color-text-tertiary);' }, 'Uploading…'),
    ]),
    h('details', { style: 'margin-top:6px;', open: !ui.widgetManager?.canUploadMedia }, [
      h('summary', { style: 'font-size:var(--font-size-xs);color:var(--color-text-tertiary);cursor:pointer;' }, 'Or paste an image URL'),
      h('input', {
        type: 'text', class: 'form-input', id: 'token-image-url',
        placeholder: 'Paste a URL or browse the library…',
        style: 'margin-top:6px;',
        defaultValue: '',
        onInput: (e) => setPortraitUrl(e.target.value),
      }),
    ]),
  ]);
}

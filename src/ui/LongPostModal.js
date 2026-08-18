
import { h } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { bindVisualEditorToggle } from './visual-editor-toggle.js';

const DRAFT_PREFIX = 'vtt:chat-draft:';

function draftKey(roomId) {
  return roomId ? `${DRAFT_PREFIX}${roomId}` : null;
}

function readDraft(roomId) {
  const k = draftKey(roomId);
  if (!k) return '';
  try { return sessionStorage.getItem(k) || ''; } catch { return ''; }
}

function writeDraft(roomId, value) {
  const k = draftKey(roomId);
  if (!k) return;
  try {
    if (value) sessionStorage.setItem(k, value);
    else sessionStorage.removeItem(k);
  } catch { /* private mode */ }
}

function LongPostBody({ ui, syncInline, roomId, initial, onClose }) {
  const rootRef = useRef(null);
  const toggleRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const textarea = root.querySelector('#long-post-textarea');
    // Set the value as a property after mount so a draft containing
    // HTML-significant characters round-trips intact.
    textarea.value = initial;
    const toggle = bindVisualEditorToggle(root, textarea);
    toggleRef.current = toggle;
    return () => toggle.destroy();
  }, []);

  const save = () => {
    toggleRef.current?.flush();
    const textarea = rootRef.current.querySelector('#long-post-textarea');
    writeDraft(roomId, textarea.value);
    syncInline?.();
    onClose();
  };

  const send = () => {
    toggleRef.current?.flush();
    const value = rootRef.current.querySelector('#long-post-textarea').value;
    if (!value.trim()) { onClose(); return; }
    ui.sendChatMessage?.(value);
    writeDraft(roomId, '');
    syncInline?.();
    onClose();
  };

  return h('div', { class: 'long-post-body', ref: rootRef }, [
    h('div', { class: 'editor-mode-toggle', role: 'tablist', 'aria-label': 'Editor mode' }, [
      h('button', { type: 'button', class: 'dbt dbt--sm', 'data-editor-mode': 'markdown', 'aria-pressed': 'true' }, 'Markdown'),
      h('button', { type: 'button', class: 'dbt dbt--sm', 'data-editor-mode': 'visual', 'aria-pressed': 'false' }, 'Visual'),
    ]),
    h('label', { for: 'long-post-textarea', class: 'sr-only' }, 'Long-form chat message'),
    h('textarea', { id: 'long-post-textarea', class: 'form-textarea long-post-textarea', rows: '14', placeholder: 'Write your post… (markdown supported)' }),
    h('div', { class: 'long-post-actions' }, [
      h('button', { type: 'button', class: 'dbt dbt--sm', 'data-long-post-action': 'cancel', 'data-modal-close': true }, 'Cancel'),
      h('button', { type: 'button', class: 'dbt dbt--sm', 'data-long-post-action': 'save', onClick: save }, 'Save draft'),
      h('button', { type: 'button', class: 'dbt btn-primary', 'data-long-post-action': 'send', onClick: send }, 'Send'),
    ]),
  ]);
}

/**
 * @param {{
 *   ui: { sendChatMessage?: (text: string) => void, widgetManager?: { roomId?: string|null } },
 *   syncInline?: () => void,
 * }} args
 */
export function openLongPostModal({ ui, syncInline }) {
  const roomId = ui?.widgetManager?.roomId ?? null;
  const initial = readDraft(roomId);
  return openModal((close) =>
    h(Modal, { id: 'long-post-modal', title: 'Long-form post', maxWidth: '760px', autoFocusSelector: '#long-post-textarea', onClose: close },
      h(LongPostBody, { ui, syncInline, roomId, initial, onClose: close }),
    ),
  );
}

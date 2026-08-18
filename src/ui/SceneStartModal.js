/**
 * SceneStartModal.js - short form for starting a new scene-thread.
 *
 * Two fields: title (required) + opening post (optional). On submit
 * we route to scene-mode.startScene which writes the thread root and
 * sets the active-scene signal. Anything markdown-y in the opening
 * post is preserved in `body` (source-of-truth) and rendered to
 * `formatted_body` for foreign clients via the same DOMPurified
 * renderMarkdown helper the rest of the chat uses.
 */

import { h } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { startScene } from './scene-mode.js';
import { bindVisualEditorToggle } from './visual-editor-toggle.js';

function SceneStartForm({ ui, onClose }) {
  const rootRef = useRef(null);
  const toggleRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const openingTa = root.querySelector('#scene-opening');
    const editorToggle = bindVisualEditorToggle(root, openingTa);
    toggleRef.current = editorToggle;
    return () => editorToggle.destroy();
  }, []);

  // Returns without closing on validation/network failure so the form
  // stays editable; startScene already toasts on those paths.
  const submit = async () => {
    toggleRef.current?.flush();
    const root = rootRef.current;
    const title = root.querySelector('#scene-title').value;
    const opener = root.querySelector('#scene-opening').value;
    if (!title.trim()) { ui._toast?.('Scene title is required', 'error'); return; }
    const scene = await startScene(ui, title, opener);
    if (!scene) return;
    ui._toast?.(`Scene started: ${scene.title}`, 'success');
    onClose();
  };

  return h('div', { ref: rootRef }, [
    h('p', { style: 'margin:0 0 10px;color:var(--color-text-secondary);font-size:13px;line-height:1.5;' },
      'Posts a thread root that everyone in the room can reply to. Every chat you send while in-scene threads under this post. Click "Leave" on the scene banner to return to the main timeline.'),
    h('div', { class: 'form-group' }, [
      h('label', { for: 'scene-title' }, ['Title ', h('span', { 'aria-hidden': 'true' }, '*')]),
      h('input', { id: 'scene-title', type: 'text', class: 'form-input', required: true, 'aria-required': 'true', placeholder: 'e.g. The Drowned Chapel', defaultValue: '' }),
    ]),
    h('div', { class: 'form-group' }, [
      h('div', { class: 'editor-mode-toggle', role: 'tablist', 'aria-label': 'Editor mode' }, [
        h('label', { for: 'scene-opening' }, 'Opening post (optional)'),
        h('span', { style: 'flex:1' }),
        h('button', { type: 'button', class: 'chip chip--active', 'data-editor-mode': 'markdown', 'aria-pressed': 'true' }, 'Markdown'),
        h('button', { type: 'button', class: 'chip', 'data-editor-mode': 'visual', 'aria-pressed': 'false' }, 'Visual'),
      ]),
      h('textarea', { id: 'scene-opening', class: 'form-input', rows: '6', style: 'resize:vertical;width:100%;font-family:inherit;', placeholder: 'Set the stage. Players can reply to this thread.' }),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { class: 'dbt', 'data-modal-close': true }, 'Cancel'),
      h('button', { class: 'dbt btn-primary', id: 'scene-submit', onClick: submit }, 'Start scene'),
    ]),
  ]);
}

export function showSceneStartModal(ui) {
  openModal((close) =>
    h(Modal, { id: 'scene-start-modal', title: 'Start a scene', autoFocusSelector: '#scene-title', onClose: close },
      h(SceneStartForm, { ui, onClose: close }),
    ),
  );
}

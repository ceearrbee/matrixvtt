/**
 * pages-panel.js - Pages tab create/edit modal with live markdown preview.
 */

import { h } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { renderMarkdown } from '../utils/renderMarkdown.js';
import { PAGE_KINDS, PAGE_VISIBILITY } from '../utils/constants.js';
import { allocateEntityId } from '../utils/stable-id.js';
import { bindVisualEditorToggle } from './visual-editor-toggle.js';
import { bindModalSubmit } from '../utils/forms.js';
import { EditorModeToggle } from './EditorModeToggle.jsx';

function PageForm({ ui, id, existing, myId, onClose }) {
  const isEdit = !!existing;
  const rootRef = useRef(null);
  const toggleRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const ta = root.querySelector('#page-body');
    const preview = root.querySelector('#page-preview');
    const refreshPreview = () => { preview.innerHTML = renderMarkdown(ta.value || ''); };
    ta.addEventListener('input', refreshPreview);
    refreshPreview();
    const editorToggle = bindVisualEditorToggle(root, ta, {
      onModeChange: (mode) => {
        // Hide the live-preview pane in visual mode (the WYSIWYG view IS
        // the preview); restore it in markdown mode.
        const pane = root.querySelector('[data-preview-pane]');
        if (pane) pane.style.display = mode === 'visual' ? 'none' : '';
        if (mode === 'markdown') refreshPreview();
      },
    });
    toggleRef.current = editorToggle;
    return () => {
      ta.removeEventListener('input', refreshPreview);
      editorToggle.destroy();
    };
  }, []);

  const submit = bindModalSubmit({
    root: () => rootRef.current,
    fields: {
      title: 'page-title', kind: 'page-kind',
      visibility: 'page-visibility', body: 'page-body',
    },
    required: { title: 'Title' },
    // The textarea is the canonical source of truth, so sync any
    // pending visual-editor content back into it before reading.
    flush: () => toggleRef.current?.flush(),
    toast: (msg, kind) => ui._toast(msg, kind),
    persist: async ({ title, kind, visibility, body }) => {
      const now = Date.now();
      await ui.state.updatePage(id, {
        id, kind, title: title.trim(), body, visibility,
        author: existing?.author ?? myId,
        thread_root_event_id: existing?.thread_root_event_id ?? null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
        last_editor: myId,
      });
    },
    onClose,
  });

  const visibility = existing?.visibility ?? PAGE_VISIBILITY.PRIVATE;
  return h('div', { ref: rootRef }, [
    h('div', { class: 'form-group' }, [
      h('label', { for: 'page-title' }, ['Title ', h('span', { 'aria-hidden': 'true' }, '*')]),
      h('input', { id: 'page-title', type: 'text', class: 'form-input', required: true, 'aria-required': 'true', defaultValue: existing?.title ?? '' }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { for: 'page-kind' }, 'Kind'),
      h('select', { id: 'page-kind', class: 'form-input' }, [
        h('option', { value: PAGE_KINDS.JOURNAL, selected: existing?.kind === PAGE_KINDS.JOURNAL }, 'Journal'),
        h('option', { value: PAGE_KINDS.LORE, selected: existing?.kind === PAGE_KINDS.LORE }, 'Lore'),
        h('option', { value: PAGE_KINDS.FICTION, selected: existing?.kind === PAGE_KINDS.FICTION }, 'Fiction'),
        h('option', { value: PAGE_KINDS.PREP, selected: existing?.kind === PAGE_KINDS.PREP }, 'Prep'),
      ]),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { for: 'page-visibility' }, 'Visibility'),
      h('select', { id: 'page-visibility', class: 'form-input' }, [
        h('option', { value: PAGE_VISIBILITY.PRIVATE, selected: visibility === PAGE_VISIBILITY.PRIVATE }, 'Private (you only)'),
        h('option', { value: PAGE_VISIBILITY.GM, selected: visibility === PAGE_VISIBILITY.GM }, 'GM-visible'),
        h('option', { value: PAGE_VISIBILITY.PLAYERS, selected: visibility === PAGE_VISIBILITY.PLAYERS }, 'Visible to all players'),
      ]),
    ]),
    h('div', { class: 'form-group' },
      h(EditorModeToggle, { label: 'Body', for: 'page-body' })),
    h('div', { class: 'form-group page-editor-split', 'data-editor-host': true }, [
      h('div', null,
        h('textarea', { id: 'page-body', class: 'form-input', rows: '14', style: 'resize:vertical;width:100%;', defaultValue: existing?.body ?? '' })),
      h('div', { 'data-preview-pane': true }, [
        h('label', null, 'Preview'),
        h('div', { id: 'page-preview', class: 'markdown-preview' }),
      ]),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { class: 'dbt', 'data-modal-close': true, 'aria-label': 'Cancel and close' }, 'Cancel'),
      h('button', { class: 'dbt btn-primary', id: 'page-submit', onClick: submit }, isEdit ? 'Save' : 'Add'),
    ]),
  ]);
}

export async function showPageForm(ui, editId = null) {
  const existing = editId ? ui.state.pages.get(editId) : null;
  const isEdit = !!existing;
  const myId = ui.state?.widgetManager?.userId ?? ui.state?.userId;
  const id = existing?.id ?? await allocateEntityId('page', ui.state.pages);

  openModal((close) =>
    h(Modal, { id: 'page-form-modal', title: isEdit ? 'Edit Page' : 'Add Page', autoFocusSelector: '#page-title', onClose: close },
      h(PageForm, { ui, id, existing, myId, onClose: close }),
    ),
  );
}

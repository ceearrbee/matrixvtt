/**
 * handouts-panel.js - Handouts tab component and rendering.
 */

import { h } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { FormReader } from '../utils/ui-helpers.js';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { confirm } from './confirm-dialogs.jsx';
import { EVENT_TYPES } from '../utils/constants.js';
import { saveChildEntity } from './child-entity-crud.js';
import { allocateEntityId } from '../utils/stable-id.js';
import { showIconPicker } from './icon-picker/IconPickerModal.jsx';
import { bindVisualEditorToggle } from './visual-editor-toggle.js';

function HandoutForm({ ui, editId, existing, onClose }) {
  const isEdit = !!existing;
  const rootRef = useRef(null);
  const toggleRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const contentTa = root.querySelector('#handout-content');
    const editorToggle = bindVisualEditorToggle(root, contentTa);
    toggleRef.current = editorToggle;
    return () => editorToggle.destroy();
  }, []);

  const pickIcon = () => showIconPicker({
    onSelect: (url) => {
      const input = rootRef.current?.querySelector('#handout-image');
      if (input) input.value = url;
    },
  });

  const submit = async () => {
    toggleRef.current?.flush();
    const data = new FormReader(rootRef.current).collect({
      title: 'handout-title',
      content: 'handout-content',
      image_url: 'handout-image',
      visible_to_players: { id: 'handout-visible', type: 'bool' },
    });
    if (!data.title) { ui._toast('Title is required', 'error'); return; }
    const id = editId ?? await allocateEntityId('handout', ui.state.handouts);
    const handout = isEdit ? { ...existing, ...data } : { ...data, created_at: Date.now() };
    const ok = await saveChildEntity(ui, {
      eventType: EVENT_TYPES.HANDOUT,
      id, entity: handout, noun: 'handout', verb: isEdit ? 'update' : 'create',
    });
    if (ok !== false) onClose();
  };

  return h('div', { ref: rootRef }, [
    h('div', { class: 'form-group' }, [
      h('label', { for: 'handout-title' }, ['Title ', h('span', { 'aria-hidden': 'true' }, '*')]),
      h('input', { id: 'handout-title', type: 'text', class: 'form-input', placeholder: "e.g. The Mayor's Letter", required: true, 'aria-required': 'true', defaultValue: existing?.title ?? '', title: 'The name of the handout' }),
    ]),
    h('div', { class: 'form-group' }, [
      h('div', { class: 'editor-mode-toggle', role: 'tablist', 'aria-label': 'Editor mode' }, [
        h('label', { for: 'handout-content' }, 'Content'),
        h('span', { style: 'flex:1' }),
        h('button', { type: 'button', class: 'chip chip--active', 'data-editor-mode': 'markdown', 'aria-pressed': 'true' }, 'Markdown'),
        h('button', { type: 'button', class: 'chip', 'data-editor-mode': 'visual', 'aria-pressed': 'false' }, 'Visual'),
      ]),
      h('textarea', { id: 'handout-content', class: 'form-input', rows: '5', placeholder: 'Read-aloud text…', style: 'resize:vertical;width:100%;', title: 'The detailed markdown text of the handout', defaultValue: existing?.content ?? '' }),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { for: 'handout-image' }, 'Image URL (optional)'),
      h('div', { style: 'display:flex;gap:6px;align-items:center;' }, [
        h('input', { id: 'handout-image', type: 'text', class: 'form-input', placeholder: 'Paste a URL or browse the library…', defaultValue: existing?.image_url ?? '', title: 'A URL or icon path to display with the handout', style: 'flex:1;' }),
        h('button', { type: 'button', class: 'dbt dbt--sm', id: 'handout-pick-icon', title: 'Browse the built-in icon library', onClick: pickIcon }, '🗃 Library'),
      ]),
    ]),
    h('div', { class: 'form-group', style: 'display:flex;align-items:center;gap:8px;', title: 'Controls whether players can see this handout in their Notes tab' }, [
      h('input', { id: 'handout-visible', type: 'checkbox', defaultChecked: !!existing?.visible_to_players, 'aria-label': 'Visible to players' }),
      h('label', { for: 'handout-visible', style: 'margin:0;' }, 'Visible to players immediately'),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { class: 'dbt', 'data-modal-close': true, 'aria-label': 'Cancel and close', title: 'Discard changes' }, 'Cancel'),
      h('button', { class: 'dbt btn-primary', id: 'handout-submit', 'aria-label': `${isEdit ? 'Save' : 'Create'} handout`, title: isEdit ? 'Save changes' : 'Create new handout', onClick: submit }, isEdit ? 'Save' : 'Create'),
    ]),
  ]);
}

export function showHandoutForm(ui, editId = null) {
  const existing = editId ? ui.state.handouts.get(editId) : null;
  const isEdit = !!existing;
  openModal((close) =>
    h(Modal, { id: 'handout-form-modal', title: isEdit ? 'Edit Handout' : 'Add Handout', autoFocusSelector: '#handout-title', onClose: close },
      h(HandoutForm, { ui, editId, existing, onClose: close }),
    ),
  );
}

// `showHandoutModal` was replaced by the floating-doc viewer (see
// FloatingDoc.jsx). Modal-wiring.js now redirects ui.showHandoutModal
// to ui.openDoc('handout', id). Handouts and Pages share one read
// surface - wikilink handling, markHandoutSeen, and stack-on-top of
// previous opens all live there.

export async function toggleHandoutVisibility(ui, id) {
  const handout = ui.state.handouts.get(id);
  if (!handout || !ui.state.isGM()) return;
  const wasVisible = !!handout.visible_to_players;
  handout.visible_to_players = !wasVisible;
  // Stamp `revealed_at` whenever visibility flips ON. The player UI
  // uses this timestamp to badge handouts that were revealed since
  // the user last opened them, so newly-shared lore doesn't get
  // missed in a long handout list.
  if (!wasVisible) handout.revealed_at = Date.now();
  await ui.state.updateHandout(id, handout);
}

const SEEN_KEY = 'mxvtt:handouts-seen';

function _readSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); }
  catch { return {}; }
}

/** Mark a handout as seen for "New" badge purposes. */
export function markHandoutSeen(id) {
  try {
    const seen = _readSeen();
    seen[id] = Date.now();
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch { /* private mode */ }
}

/** Has this user not yet opened the handout since it was revealed? */
export function isHandoutNew(handout, id) {
  if (!handout?.visible_to_players) return false;
  const revealedAt = handout.revealed_at ?? 0;
  if (!revealedAt) return false;
  const seenAt = _readSeen()[id] ?? 0;
  return revealedAt > seenAt;
}

// Tables (showTableForm, rollTable, deleteTable) live in `src/ui/tables/`
// - this file is for handouts only.

export function deleteHandout(ui, id) {
  if (!ui.state.isGM()) return;
  const handout = ui.state.handouts.get(id);
  const name = handout?.title || 'this handout';
  confirm(h('span', null, ['Delete handout ', h('strong', null, name), '?']), async () => {
    await ui.state.removeHandout(id);
  });
}

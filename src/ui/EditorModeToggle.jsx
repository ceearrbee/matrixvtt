/**
 * EditorModeToggle - the Markdown / Visual switch that sits above a
 * markdown textarea. Four editors declared their own copy of these two
 * buttons; `bindVisualEditorToggle` in visual-editor-toggle.js reads the
 * `data-editor-mode` attributes and owns the behaviour.
 *
 * `label` + `for` render the field's own label inside the same row, which
 * is how three of the four laid it out; omit both for a bare toggle.
 */

import { h } from 'preact';

export function EditorModeToggle({ label = '', for: htmlFor = '', chipClass = 'chip' }) {
  const active = chipClass === 'chip' ? 'chip chip--active' : chipClass;
  return h('div', { class: 'editor-mode-toggle', role: 'tablist', 'aria-label': 'Editor mode' }, [
    label && h('label', { for: htmlFor }, label),
    label && h('span', { style: 'flex:1' }),
    h('button', {
      type: 'button', class: active,
      'data-editor-mode': 'markdown', 'aria-pressed': 'true',
    }, 'Markdown'),
    h('button', {
      type: 'button', class: chipClass,
      'data-editor-mode': 'visual', 'aria-pressed': 'false',
    }, 'Visual'),
  ]);
}

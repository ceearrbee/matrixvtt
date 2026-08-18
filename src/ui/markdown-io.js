/**
 * markdown-io.js - character/NPC markdown import/export.
 * Campaign JSON lives in `src/state/campaign-sync.js`;
 * ruleset JSON in `./ruleset-io.js`.
 */

import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { Modal } from './Modal.jsx';
import { openModal } from './modal-host.js';
import { MODAL_WIDTHS } from '../utils/ui-constants.js';
import { characterToMarkdown, npcToMarkdown } from './markdown-format.js';

export function exportCharactersMarkdown(ui) {
  const characters = Array.from(ui.state.characters.entries());
  if (characters.length === 0) { ui._toast('No characters to export', 'info'); return; }

  let markdown = '# Characters\n\n';
  markdown += `*Exported from MatrixVTT on ${new Date().toISOString()}*\n\n---\n\n`;
  for (const [id, char] of characters) {
    markdown += ui.characterToMarkdown(char, id);
    markdown += '\n---\n\n';
  }
  ui.downloadMarkdown(markdown, 'characters.md');
  ui._toast?.(`Exported ${characters.length} character${characters.length === 1 ? '' : 's'}`, 'success');
}

export function exportNPCsMarkdown(ui) {
  const npcs = Array.from(ui.state.npcs.entries());
  if (npcs.length === 0) { ui._toast('No NPCs to export', 'info'); return; }

  let markdown = '# NPCs\n\n';
  markdown += `*Exported from MatrixVTT on ${new Date().toISOString()}*\n\n---\n\n`;
  for (const [id, npc] of npcs) {
    markdown += ui.npcToMarkdown(npc, id);
    markdown += '\n---\n\n';
  }
  ui.downloadMarkdown(markdown, 'npcs.md');
  ui._toast?.(`Exported ${npcs.length} NPC${npcs.length === 1 ? '' : 's'}`, 'success');
}

export { characterToMarkdown, npcToMarkdown };

export function downloadMarkdown(_ui, content, filename) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportMarkdownBody({ ui, onClose }) {
  const rootRef = useRef(null);

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const ta = rootRef.current?.querySelector('#md-text-input');
      if (ta) ta.value = /** @type {string} */ (event.target.result);
    };
    reader.onerror = () => ui._toast('Failed to read file', 'error');
    reader.readAsText(file);
  };

  const submit = async () => {
    const content = rootRef.current.querySelector('#md-text-input').value;
    if (!content.trim()) {
      ui._toast('Please upload a file or paste markdown content', 'info');
      return;
    }
    await ui.importMarkdown(content);
    onClose();
  };

  return h('div', { ref: rootRef }, [
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label', for: 'md-file-input' }, 'Upload Markdown File'),
      h('input', { type: 'file', class: 'form-input', id: 'md-file-input', accept: '.md,.markdown,.txt', onChange: onFileChange }),
      h('small', { style: 'font-size: 11px; color: var(--color-text-tertiary);' },
        'Upload a markdown file exported from MatrixVTT (characters.md or npcs.md)'),
    ]),
    h('div', { class: 'form-group' }, [
      h('label', { class: 'form-label' }, 'Or Paste Markdown'),
      h('textarea', { class: 'form-textarea', id: 'md-text-input', placeholder: 'Paste markdown content here...', style: 'min-height: 200px; font-family: monospace; font-size: 12px;' }),
    ]),
    h('div', { class: 'form-actions' }, [
      h('button', { type: 'button', class: 'dbt', 'data-modal-close': true }, 'Cancel'),
      h('button', { type: 'button', class: 'dbt btn-primary', id: 'import-md-submit', onClick: submit }, 'Import'),
    ]),
  ]);
}

export function showImportMarkdownDialog(ui) {
  openModal((close) =>
    h(Modal, { id: 'import-md-modal', title: 'Import from Markdown', maxWidth: MODAL_WIDTHS.LARGE, onClose: close },
      h(ImportMarkdownBody, { ui, onClose: close }),
    ),
  );
}

export async function importMarkdown(ui, content) {
  try {
    const isCharacters = content.includes('# Characters');
    const isNPCs = content.includes('# NPCs');
    if (!isCharacters && !isNPCs) {
      ui._toast('Invalid markdown format. File must start with "# Characters" or "# NPCs"');
      return;
    }

    const sections = content.split(/^---$/m).filter((s) => s.trim() && !s.includes('*Exported from'));

    let imported = 0;
    let errors = 0;
    for (const section of sections) {
      try {
        if (isCharacters) { await ui.importCharacterFromMarkdown(section); imported++; }
        else if (isNPCs)  { await ui.importNPCFromMarkdown(section); imported++; }
      } catch { errors++; }
    }

    ui._toast(`Import complete - ${imported} imported, ${errors} errors`, errors > 0 ? 'error' : 'success');
  } catch (err) {
    ui._toast('Import failed: ' + err.message);
  }
}

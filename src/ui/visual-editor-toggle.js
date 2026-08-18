/**
 * visual-editor-toggle.js - wire a [Markdown | Visual] chip pair to
 * mount/teardown a WYSIWYG editor over a backing <textarea>.
 *
 * The textarea remains the canonical source of truth. Visual mode is a
 * parallel authoring view that gets squashed back into the textarea on
 * toggle-off or modal submit (via the returned `flush()` helper).
 *
 * Usage in a ModalFactory body:
 *
 *   <div class="editor-mode-toggle">
 *     <button data-editor-mode="markdown" aria-pressed="true">Markdown</button>
 *     <button data-editor-mode="visual">Visual</button>
 *   </div>
 *   <textarea id="…">…</textarea>
 *
 * Then in the opener:
 *
 *   const toggle = bindVisualEditorToggle(modal, ta);
 *   // … in submit handler:
 *   toggle.flush();          // pulls any pending visual content back
 *   const body = ta.value;
 *   // … on modal close:
 *   toggle.destroy();        // tears down the WYSIWYG editor
 */

import { mountMarkdownEditor } from './markdown-editor.js';
import { logger } from '../utils/logger.js';

/**
 * @param {HTMLElement} modal
 * @param {HTMLTextAreaElement} textarea
 * @param {{ onModeChange?: (mode: 'markdown'|'visual') => void }} [opts]
 */
export function bindVisualEditorToggle(modal, textarea, opts = {}) {
  const onModeChange = opts.onModeChange;
  let mode = 'markdown';
  let editorHandle = null;
  let visualContainer = null;

  const mdBtn = modal.querySelector('[data-editor-mode="markdown"]');
  const visBtn = modal.querySelector('[data-editor-mode="visual"]');

  /** @param {'markdown'|'visual'} active */
  function setChips(active) {
    /** @type {Array<[Element|null, 'markdown'|'visual']>} */
    const entries = [[mdBtn, 'markdown'], [visBtn, 'visual']];
    for (const [btn, id] of entries) {
      if (!btn) continue;
      const on = id === active;
      btn.classList.toggle('chip--active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
  }

  async function switchToVisual() {
    if (mode === 'visual') return;
    visualContainer = document.createElement('div');
    visualContainer.className = 'markdown-editor-host';
    textarea.parentNode.insertBefore(visualContainer, textarea);
    textarea.style.display = 'none';
    try {
      editorHandle = await mountMarkdownEditor(visualContainer, {
        initialValue: textarea.value,
      });
    } catch (err) {
      visualContainer.remove();
      visualContainer = null;
      textarea.style.display = '';
      setChips('markdown');
      logger.warn('VisualEditor', `mount failed: ${err?.message ?? err}`);
      return;
    }
    mode = 'visual';
    setChips('visual');
    onModeChange?.('visual');
  }

  function switchToMarkdown() {
    if (mode === 'markdown') return;
    if (editorHandle) {
      textarea.value = editorHandle.getMarkdown();
      editorHandle.destroy();
      editorHandle = null;
    }
    if (visualContainer) {
      visualContainer.remove();
      visualContainer = null;
    }
    textarea.style.display = '';
    mode = 'markdown';
    setChips('markdown');
    onModeChange?.('markdown');
  }

  mdBtn?.addEventListener('click', switchToMarkdown);
  visBtn?.addEventListener('click', switchToVisual);

  return {
    /** Pull pending visual content into the textarea (called before submit). */
    flush() {
      if (mode === 'visual' && editorHandle) {
        textarea.value = editorHandle.getMarkdown();
      }
    },
    /** Tear down the WYSIWYG editor; safe to call from modal close. */
    destroy() {
      if (editorHandle) {
        try { editorHandle.destroy(); } catch { /* noop */ }
        editorHandle = null;
      }
      if (visualContainer) {
        visualContainer.remove();
        visualContainer = null;
      }
    },
    get mode() { return mode; },
  };
}

/**
 * markdown-editor.js - dynamic-import wrapper around @toast-ui/editor.
 *
 * The visual (WYSIWYG) mode for the three markdown editors (Pages,
 * Handouts, Scene-start) routes through this helper. Markdown remains
 * the canonical source: the textarea in each modal stays the truth,
 * and Visual mode is a parallel authoring view that gets squashed back
 * into the textarea on toggle-off / submit.
 *
 * The editor JS + CSS are loaded lazily so the auth bundle isn't paying
 * the ~80 KB gzipped cost up front. After first open the SW caches the
 * chunk, so subsequent opens are local.
 */

let _editorModule = null;

async function loadEditor() {
  if (!_editorModule) {
    const [mod] = await Promise.all([
      import('@toast-ui/editor'),
      import('@toast-ui/editor/dist/toastui-editor.css'),
    ]);
    _editorModule = mod;
  }
  return _editorModule;
}

/**
 * @param {HTMLElement} container
 * @param {{ initialValue?: string, height?: string }} [opts]
 * @returns {Promise<{ getMarkdown: () => string, setMarkdown: (md: string) => void, destroy: () => void }>}
 */
export async function mountMarkdownEditor(container, { initialValue = '', height = '320px' } = {}) {
  const { Editor } = await loadEditor();
  const editor = new Editor({
    el: container,
    initialEditType: 'wysiwyg', // user clicked "Visual"; preview path
    previewStyle: 'tab',
    initialValue,
    height,
    usageStatistics: false,
    toolbarItems: [
      ['heading', 'bold', 'italic', 'strike'],
      ['hr', 'quote'],
      ['ul', 'ol'],
      ['table', 'link'],
      ['code', 'codeblock'],
    ],
  });
  return {
    getMarkdown: () => editor.getMarkdown() ?? '',
    setMarkdown: (md) => editor.setMarkdown(md ?? ''),
    destroy: () => { try { editor.destroy(); } catch { /* noop */ } },
  };
}

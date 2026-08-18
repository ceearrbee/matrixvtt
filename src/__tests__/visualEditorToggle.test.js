import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the markdown-editor wrapper before importing the toggle.
vi.mock('../ui/markdown-editor.js', () => ({
  mountMarkdownEditor: vi.fn(async (container, { initialValue }) => {
    let md = initialValue ?? '';
    container.setAttribute('data-mounted', 'true');
    return {
      getMarkdown: () => md,
      setMarkdown: (v) => { md = v; },
      destroy: () => container.setAttribute('data-mounted', 'false'),
    };
  }),
}));

const { bindVisualEditorToggle } = await import('../ui/visual-editor-toggle.js');
const { mountMarkdownEditor } = await import('../ui/markdown-editor.js');

function makeModal(initial = '') {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="editor-mode-toggle">
      <button data-editor-mode="markdown" aria-pressed="true" class="chip chip--active">Markdown</button>
      <button data-editor-mode="visual"   aria-pressed="false" class="chip">Visual</button>
    </div>
    <textarea id="body"></textarea>
  `;
  const ta = /** @type {HTMLTextAreaElement} */ (modal.querySelector('#body'));
  ta.value = initial;
  document.body.appendChild(modal);
  return { modal, ta };
}

describe('bindVisualEditorToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mountMarkdownEditor.mockClear();
  });

  it('defaults to markdown mode with the textarea visible', () => {
    const { modal, ta } = makeModal('hello');
    const t = bindVisualEditorToggle(modal, ta);
    expect(t.mode).toBe('markdown');
    expect(ta.style.display).toBe('');
    expect(mountMarkdownEditor).not.toHaveBeenCalled();
  });

  it('clicking Visual mounts the editor with the textarea value and hides the textarea', async () => {
    const { modal, ta } = makeModal('## hi');
    bindVisualEditorToggle(modal, ta);
    const visBtn = modal.querySelector('[data-editor-mode="visual"]');
    visBtn.click();
    await Promise.resolve(); // flush mountMarkdownEditor promise
    expect(mountMarkdownEditor).toHaveBeenCalledTimes(1);
    expect(mountMarkdownEditor.mock.calls[0][1].initialValue).toBe('## hi');
    expect(ta.style.display).toBe('none');
    expect(visBtn.classList.contains('chip--active')).toBe(true);
    expect(visBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking Markdown after Visual flushes content back to the textarea', async () => {
    const { modal, ta } = makeModal('start');
    const t = bindVisualEditorToggle(modal, ta);
    modal.querySelector('[data-editor-mode="visual"]').click();
    await Promise.resolve();
    // Simulate edits in the visual editor:
    // The mock's setMarkdown is reachable via getMarkdown reading the
    // closure variable; we can't easily reach it from here, so instead
    // we assert flush is a no-op while editor returns the seed value.
    // To actually exercise post-edit content, mutate via the handle:
    const handle = mountMarkdownEditor.mock.results[0].value
      ? await mountMarkdownEditor.mock.results[0].value
      : null;
    handle.setMarkdown('# edited');
    // Click Markdown
    modal.querySelector('[data-editor-mode="markdown"]').click();
    expect(t.mode).toBe('markdown');
    expect(ta.value).toBe('# edited');
    expect(ta.style.display).toBe('');
  });

  it('flush() pulls visual content into the textarea without leaving visual mode', async () => {
    const { modal, ta } = makeModal('a');
    const t = bindVisualEditorToggle(modal, ta);
    modal.querySelector('[data-editor-mode="visual"]').click();
    await Promise.resolve();
    const handle = await mountMarkdownEditor.mock.results[0].value;
    handle.setMarkdown('b');
    t.flush();
    expect(ta.value).toBe('b');
    expect(t.mode).toBe('visual');
  });

  it('destroy() tears down the editor cleanly', async () => {
    const { modal, ta } = makeModal('a');
    const t = bindVisualEditorToggle(modal, ta);
    modal.querySelector('[data-editor-mode="visual"]').click();
    await Promise.resolve();
    t.destroy();
    expect(modal.querySelector('.markdown-editor-host')).toBeNull();
  });

  it('fails-safe to markdown mode if the editor module fails to load', async () => {
    mountMarkdownEditor.mockImplementationOnce(() => Promise.reject(new Error('chunk fail')));
    const { modal, ta } = makeModal('keep me');
    const t = bindVisualEditorToggle(modal, ta);
    modal.querySelector('[data-editor-mode="visual"]').click();
    await Promise.resolve();
    expect(t.mode).toBe('markdown');
    expect(ta.style.display).toBe('');
    expect(ta.value).toBe('keep me');
  });
});

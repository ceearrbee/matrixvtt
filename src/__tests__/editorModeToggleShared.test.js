/**
 * Four copies of the Markdown / Visual toggle drifted: three used
 * `.chip`, one used `.dbt dbt--sm`, and each re-declared the same two
 * buttons and the same `data-editor-mode` contract that
 * `bindVisualEditorToggle` reads. One component now renders it.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render } from 'preact';
import { h } from 'preact';
import { EditorModeToggle } from '../ui/EditorModeToggle.jsx';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

const CALLERS = [
  'src/ui/handouts-panel.js',
  'src/ui/pages-panel.js',
  'src/ui/SceneStartModal.js',
  'src/ui/LongPostModal.js',
];

describe('EditorModeToggle', () => {
  it('renders the two modes with the contract bindVisualEditorToggle reads', () => {
    const host = document.createElement('div');
    render(h(EditorModeToggle, { label: 'Content', for: 'x' }), host);
    const md = host.querySelector('[data-editor-mode="markdown"]');
    const vis = host.querySelector('[data-editor-mode="visual"]');
    expect(md.getAttribute('aria-pressed')).toBe('true');
    expect(vis.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    render(null, host);
  });

  it('carries the field label when one is given, and omits it otherwise', () => {
    const host = document.createElement('div');
    render(h(EditorModeToggle, { label: 'Body', for: 'page-body' }), host);
    expect(host.querySelector('label[for="page-body"]').textContent).toBe('Body');
    render(h(EditorModeToggle, {}), host);
    expect(host.querySelector('label')).toBeNull();
    render(null, host);
  });

  it('is the only place those two buttons are declared', () => {
    for (const f of CALLERS) {
      const src = read(f);
      expect(src, f).not.toMatch(/'data-editor-mode': 'markdown'/);
      expect(src, f).toMatch(/EditorModeToggle/);
    }
  });
});

/**
 * LibraryPreview renders a read-only detail view per kind: item/spell via
 * the shared card renderers, maps as a thumbnail + facts, rulesets as a
 * fact grid, and everything else as a generic fact grid.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { LibraryPreview } from '../ui/library/LibraryPreview.jsx';

function makeUi() {
  return { widgetManager: { homeserver: 'https://hs' }, state: { settings: { systemConfig: {} } } };
}

afterEach(cleanup);

describe('LibraryPreview', () => {
  it('shows the name, kind badge, and generic facts for an NPC', () => {
    const entry = { id: 'lib-1', kind: 'npc', name: 'Goblin', data: { hp: 7, notes: 'sneaky' }, updated_at: 0 };
    const { container } = render(h(LibraryPreview, { ui: makeUi(), entry, sourceLabel: 'My library' }));
    const root = container.querySelector('[data-library-preview="lib-1"]');
    expect(root.textContent).toContain('Goblin');
    expect(root.textContent).toContain('NPC');
    expect(root.textContent).toContain('hp');
    expect(root.querySelector('.library-preview__notes').textContent).toBe('sneaky');
  });

  it('renders a map thumbnail resolved from an mxc uri plus dimensions', () => {
    const entry = { id: 'lib-9', kind: 'map', name: 'Cave', data: { image_url: 'mxc://s/abc', width_cells: 30, height_cells: 20 } };
    const { container } = render(h(LibraryPreview, { ui: makeUi(), entry }));
    const img = container.querySelector('.library-preview__thumb');
    expect(img.getAttribute('src')).toBe('https://hs/_matrix/media/v3/download/s/abc');
    expect(container.textContent).toContain('30 × 20 cells');
  });

  it('summarises a ruleset with meta facts', () => {
    const entry = { id: 'lib-r', kind: 'ruleset', name: 'FATE', data: { system: 'fate', version: '1.0', attributes: [{ key: 'a' }] } };
    const { container } = render(h(LibraryPreview, { ui: makeUi(), entry }));
    expect(container.textContent).toContain('fate');
    expect(container.textContent).toContain('Attributes');
  });
});

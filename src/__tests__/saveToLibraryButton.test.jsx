/**
 * SaveToLibraryButton renders only in standalone mode and triggers a save.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';

const { mockSaveToLibrary } = vi.hoisted(() => ({ mockSaveToLibrary: vi.fn() }));
vi.mock('../ui/library/save-to-library.js', () => ({
  saveToLibrary: mockSaveToLibrary,
  libraryAvailable: (ui) => !!ui?.widgetManager?.isAppClient && !!ui.widgetManager.getMatrixClient?.(),
}));

import { SaveToLibraryButton } from '../ui/library/SaveToLibraryButton.jsx';

afterEach(() => { cleanup(); mockSaveToLibrary.mockClear(); });

const standalone = { widgetManager: { isAppClient: true, getMatrixClient: () => ({}) } };
const widget = { widgetManager: { isAppClient: false, getMatrixClient: () => null } };

describe('SaveToLibraryButton', () => {
  it('renders nothing in widget mode', () => {
    const { container } = render(h(SaveToLibraryButton, { ui: widget, kind: 'npc', entity: { name: 'Goblin' } }));
    expect(container.querySelector('[data-save-to-library]')).toBeNull();
  });

  it('renders and saves in standalone mode', () => {
    const { container } = render(h(SaveToLibraryButton, { ui: standalone, kind: 'npc', entity: { name: 'Goblin' } }));
    const btn = container.querySelector('[data-save-to-library="npc"]');
    expect(btn).not.toBeNull();
    fireEvent.click(btn);
    expect(mockSaveToLibrary).toHaveBeenCalledWith(standalone, 'npc', { name: 'Goblin' }, null);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const saveEntry = vi.fn(async () => 'lib-1');
vi.mock('../library/LibraryManager.js', () => ({
  LibraryManager: class {
    saveEntry(...args) { return saveEntry(...args); }
  },
}));

import { saveToLibrary } from '../ui/library/save-to-library.js';
import { LIBRARY_KIND } from '../utils/constants.js';

function standaloneUi() {
  return {
    _toast: vi.fn(),
    widgetManager: { isAppClient: true, getMatrixClient: () => ({}) },
  };
}

beforeEach(() => saveEntry.mockClear());

describe('saveToLibrary', () => {
  it('saves an entity and toasts on success', async () => {
    const ui = standaloneUi();
    await saveToLibrary(ui, LIBRARY_KIND.NPC, { id: 'npc-3', name: 'Goblin', hp: 7 });
    expect(saveEntry).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'npc', name: 'Goblin', data: { id: 'npc-3', name: 'Goblin', hp: 7 },
    }));
    expect(ui._toast).toHaveBeenCalledWith(expect.stringContaining('library'), 'success');
  });

  it('derives the name from the entity when none is given', async () => {
    const ui = standaloneUi();
    await saveToLibrary(ui, LIBRARY_KIND.ITEM, { name: 'Rope' });
    expect(saveEntry.mock.calls[0][0].name).toBe('Rope');
  });

  it('wraps a ruleset with its system slug', async () => {
    const ui = standaloneUi();
    await saveToLibrary(ui, LIBRARY_KIND.RULESET, { name: 'FATE' }, {
      system: 'fate', systemConfig: { name: 'FATE', attributes: [] },
    });
    expect(saveEntry.mock.calls[0][0].data).toEqual({ system: 'fate', name: 'FATE', attributes: [] });
  });

  it('is a no-op when the library is unavailable', async () => {
    const ui = { _toast: vi.fn(), widgetManager: { isAppClient: false, getMatrixClient: () => null } };
    await saveToLibrary(ui, LIBRARY_KIND.NPC, { name: 'Goblin' });
    expect(saveEntry).not.toHaveBeenCalled();
  });

  it('toasts an error when the save fails', async () => {
    saveEntry.mockRejectedValueOnce(new Error('too big'));
    const ui = standaloneUi();
    await saveToLibrary(ui, LIBRARY_KIND.RULESET, { name: 'Huge' }, { system: 'x', systemConfig: {} });
    expect(ui._toast).toHaveBeenCalledWith(expect.stringContaining('too big'), 'error');
  });
});

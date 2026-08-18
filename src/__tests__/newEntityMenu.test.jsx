/**
 * The + New create hub opens a modal of create tiles, each routing to an
 * existing create flow and closing the hub.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openNewMenu } from '../ui/NewEntityMenu.jsx';
import { closeAllOpenModals } from '../ui/modal-host.js';

function makeUi() {
  return {
    showEntityForm: vi.fn(),
    showItemForm: vi.fn(),
    showSpellForm: vi.fn(),
    showTokenForm: vi.fn(),
    showTableForm: vi.fn(),
    showHandoutForm: vi.fn(),
    showPageForm: vi.fn(),
    openMapsPanel: vi.fn(),
  };
}

afterEach(() => { closeAllOpenModals(); document.body.innerHTML = ''; });

describe('openNewMenu', () => {
  it('offers create tiles for every entity type', () => {
    openNewMenu(makeUi());
    for (const k of ['character', 'npc', 'token', 'item', 'spell', 'table', 'map', 'scene', 'handout', 'page']) {
      expect(document.querySelector(`[data-new="${k}"]`), k).not.toBeNull();
    }
  });

  it('routes a tile to its create flow and closes the hub', () => {
    const ui = makeUi();
    openNewMenu(ui);
    document.querySelector('[data-new="item"]').click();
    expect(ui.showItemForm).toHaveBeenCalledWith(null);
    expect(document.querySelector('#new-entity-modal')).toBeNull();
  });

  it('creates a character via the entity form', () => {
    const ui = makeUi();
    openNewMenu(ui);
    document.querySelector('[data-new="character"]').click();
    expect(ui.showEntityForm).toHaveBeenCalled();
  });
});

/**
 * Loot tables - post-roll action flow.
 *
 * When a rolled entry has an `item_id` referencing a known item, the UI
 * surfaces a prompt with three actions:
 *   - Award to PC (opens a PC picker; pick → append to inventory_ids)
 *   - Drop on map (sets pendingPlacementSignal for the map click handler)
 *   - Just close
 * Item-less entries skip the prompt entirely.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rollTable } from '../ui/tables/rollTable.js';
import {
  awardItemToCharacter,
  beginItemDrop,
  spawnItemToken,
  synthItemFromText,
} from '../ui/tables/loot-actions.js';
import { pendingPlacementSignal } from '../state/signals.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi({ tables = {}, items = {}, characters = {} } = {}) {
  const state = withFacade({
    isGM: () => true,
    tables: new Map(Object.entries(tables)),
    items: new Map(Object.entries(items)),
    characters: new Map(Object.entries(characters)),
    activeMapId: 'map-keep',
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
  return {
    state,
    _toast: vi.fn(),
    _log: vi.fn(),
    createToken: vi.fn().mockResolvedValue(true),
  };
}

describe('rollTable - item-linked entry surfaces action prompt', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    pendingPlacementSignal.value = null;
    // Force the first entry deterministically.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens loot-action modal when rolled entry has a resolvable item_id', () => {
    const ui = makeUi({
      tables: {
        'tbl-1': { name: 'Loot', entries: [{ weight: 1, text: 'Goblin Ear', item_id: 'itm-ear' }] },
      },
      items: { 'itm-ear': { name: 'Goblin Ear' } },
    });
    rollTable(ui, 'tbl-1');
    const modal = document.getElementById('loot-action-modal');
    expect(modal).toBeTruthy();
    const award = modal.querySelector('[data-loot-award]');
    const drop = modal.querySelector('[data-loot-drop]');
    expect(award).toBeTruthy();
    expect(drop).toBeTruthy();
    // Plain-text labels - no leading emoji that could be confused for
    // the emoji picker.
    expect(award.textContent.trim()).toBe('Award to PC…');
    expect(drop.textContent.trim()).toBe('Drop on map');
  });

  it('opens the prompt for text-only entries too (synthesises an item on award/drop)', () => {
    const ui = makeUi({
      tables: { 'tbl-1': { name: 'Junk', entries: [{ weight: 1, text: 'Old Boot' }] } },
    });
    rollTable(ui, 'tbl-1');
    const modal = document.getElementById('loot-action-modal');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toMatch(/no linked item/i);
  });

  it('opens the prompt with the "no linked item" hint when item_id no longer resolves', () => {
    const ui = makeUi({
      tables: {
        'tbl-1': { name: 'Loot', entries: [{ weight: 1, text: 'Phantom', item_id: 'itm-ghost' }] },
      },
      items: {},
    });
    rollTable(ui, 'tbl-1');
    const modal = document.getElementById('loot-action-modal');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toMatch(/no linked item/i);
  });
});

describe('awardItemToCharacter', () => {
  it('appends the item id to the character inventory and persists', async () => {
    const ui = makeUi({
      characters: { 'chr-1': { name: 'Aria', inventory_ids: ['itm-existing'] } },
      items: { 'itm-ear': { name: 'Goblin Ear' } },
    });
    const ok = await awardItemToCharacter(ui, 'chr-1', 'itm-ear');
    expect(ok).toBe(true);
    expect(ui.state.characters.get('chr-1').inventory_ids).toEqual(['itm-existing', 'itm-ear']);
    expect(ui.state.sendStateEvent).toHaveBeenCalledWith(
      'com.vtt.character',
      'chr-1',
      expect.objectContaining({ inventory_ids: ['itm-existing', 'itm-ear'] })
    );
  });

  it('returns false if the character is missing', async () => {
    const ui = makeUi();
    const ok = await awardItemToCharacter(ui, 'chr-missing', 'itm-x');
    expect(ok).toBe(false);
  });
});

describe('synthItemFromText', () => {
  it('creates a Loot-type item with the rolled text as the name', async () => {
    const ui = makeUi();
    const id = await synthItemFromText(ui, 'Pearl earring (50 gp)');
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    // The new item is now in state and discoverable by id.
    const item = ui.state.items.get(id);
    expect(item.name).toBe('Pearl earring (50 gp)');
    expect(item.type).toBe('Loot');
    expect(item.synthesized).toBe(true);
  });

  it('falls back to a placeholder name on empty input', async () => {
    const ui = makeUi();
    const id = await synthItemFromText(ui, '');
    expect(id).toBeTruthy();
    expect(ui.state.items.get(id).name).toBe('rolled item');
  });
});

describe('beginItemDrop / spawnItemToken', () => {
  beforeEach(() => {
    pendingPlacementSignal.value = null;
  });

  it('beginItemDrop sets the placement signal', () => {
    const ui = makeUi();
    beginItemDrop(ui, 'itm-ear');
    expect(pendingPlacementSignal.value).toEqual({ kind: 'item-token', itemId: 'itm-ear' });
  });

  it('beginItemDrop closes any open modals so the next click reaches the map', () => {
    // Simulate the live state when the GM hits Drop: the GM tools modal
    // AND the loot-action prompt are both mounted on the body. Without
    // this cleanup, the next map click hits the modal backdrop, closes
    // the modal, and silently misses the stage.
    document.body.innerHTML = `
      <div class="modal-overlay" id="gm-panel-modal"></div>
      <div class="modal-overlay" id="loot-action-modal"></div>
    `;
    const ui = makeUi();
    beginItemDrop(ui, 'itm-ear');
    expect(document.querySelectorAll('.modal-overlay').length).toBe(0);
  });

  it('spawnItemToken creates a token derived from the item with the active map_id', async () => {
    const ui = makeUi({ items: { 'itm-ear': { name: 'Goblin Ear', image_url: 'x.png' } } });
    const ok = await spawnItemToken(ui, 'itm-ear', { col: 5, row: 7 });
    expect(ok).toBe(true);
    expect(ui.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Goblin Ear',
        type: 'item',
        item_id: 'itm-ear',
        map_id: 'map-keep',
        col: 5,
        row: 7,
        image_url: 'x.png',
      })
    );
  });

  it('spawnItemToken clamps negative col/row to zero so token schema does not reject it', async () => {
    const ui = makeUi({ items: { 'itm-ear': { name: 'Goblin Ear' } } });
    await spawnItemToken(ui, 'itm-ear', { col: -3, row: -7 });
    expect(ui.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ col: 0, row: 0 }),
    );
  });

  it('spawnItemToken refuses to drop when no map is active', async () => {
    const ui = makeUi({ items: { 'itm-ear': { name: 'Goblin Ear' } } });
    ui.state.activeMapId = null;
    const ok = await spawnItemToken(ui, 'itm-ear', { col: 1, row: 1 });
    expect(ok).toBe(false);
    expect(ui.createToken).not.toHaveBeenCalled();
    expect(ui._toast).toHaveBeenCalled();
  });
});

/**
 * A door the GM cannot see is no better than the right-click-only
 * verbs P11 gave homes to. The pin form has to be able to name a
 * destination, the map has to show which pins are doors, and the
 * travel action needs a path that is not a right-click.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/preact';
import { showPinForm, showEditPinForm } from '../map/actions/pins.js';
import { showPinContextMenu } from '../map/context-menus.js';
import { buildPaletteCommands } from '../ui/palette-commands.js';
import { closeAllOpenModals } from '../ui/modal-host.js';

const CAVE = { id: 'map-1', width_cells: 20, height_cells: 20, cell_px: 40 };
const KEEP = { id: 'map-2', name: 'The Keep', width_cells: 6, height_cells: 6, cell_px: 40 };
const arrival = { id: 'pin-2', map_id: 'map-2', col: 2, row: 2, label: 'Gatehouse' };
const door = { id: 'pin-1', map_id: 'map-1', col: 3, row: 3, label: 'Cave mouth', target_pin_id: 'pin-2' };

function makeMr({ isGM = true } = {}) {
  return /** @type {any} */ ({
    state: {
      isGM: () => isGM,
      activeMapId: 'map-1',
      map: CAVE,
      pins: new Map([['pin-1', door], ['pin-2', arrival]]),
      maps: new Map([['map-1', { ...CAVE, name: 'The Cave' }], ['map-2', KEEP]]),
      tokens: new Map(),
      addPin: vi.fn(async () => {}),
      updatePin: vi.fn(async () => {}),
      switchMap: vi.fn(async () => {}),
      updateToken: vi.fn(async () => {}),
    },
  });
}

afterEach(() => {
  closeAllOpenModals();
  cleanup();
  document.querySelectorAll('.context-menu').forEach((m) => m.remove());
});

describe('the pin form can name a destination', () => {
  it('offers every pin on another map, named by that map', () => {
    const mr = makeMr();
    showPinForm(mr, 5, 5);
    const select = document.querySelector('select[name="target_pin_id"]');
    expect(select, 'no destination picker on the pin form').toBeTruthy();
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(options.some((o) => /The Keep/.test(o) && /Gatehouse/.test(o))).toBe(true);
  });

  it('stays out of the way on a campaign with nowhere to go', () => {
    const mr = makeMr();
    mr.state.pins = new Map();
    showPinForm(mr, 5, 5);
    expect(document.querySelector('select[name="target_pin_id"]')).toBeNull();
    expect(document.querySelector('#pin-label-input')).toBeTruthy();
  });

  it('does not offer a pin on the map being edited', () => {
    const mr = makeMr();
    showPinForm(mr, 5, 5);
    const values = [...document.querySelectorAll('select[name="target_pin_id"] option')]
      .map((o) => o.getAttribute('value'));
    expect(values).not.toContain('pin-1');
  });

  it('shows an existing door its current destination', () => {
    showEditPinForm(makeMr(), door);
    const select = /** @type {HTMLSelectElement} */ (document.querySelector('select[name="target_pin_id"]'));
    expect(select.value).toBe('pin-2');
  });

  it('lets a door be turned back into a plain marker', async () => {
    const mr = makeMr();
    showEditPinForm(mr, door);
    const select = /** @type {HTMLSelectElement} */ (document.querySelector('select[name="target_pin_id"]'));
    select.value = '';
    fireEvent.submit(document.querySelector('[data-pin-form]'));
    await Promise.resolve();
    expect(mr.state.updatePin).toHaveBeenCalledWith('pin-1', expect.objectContaining({ target_pin_id: '' }));
  });

  it('writes the destination onto the pin', async () => {
    const mr = makeMr();
    showPinForm(mr, 5, 5);
    const label = /** @type {HTMLInputElement} */ (document.querySelector('#pin-label-input'));
    label.value = 'Trapdoor';
    const select = /** @type {HTMLSelectElement} */ (document.querySelector('select[name="target_pin_id"]'));
    select.value = 'pin-2';
    fireEvent.submit(document.querySelector('[data-pin-form]'));
    await Promise.resolve();
    expect(mr.state.addPin).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Trapdoor', target_pin_id: 'pin-2' }),
    );
  });
});

describe('the door offers the trip', () => {
  it('the pin menu leads with moving the party, named for where they land', () => {
    const menu = showPinContextMenu(makeMr(), door, 0, 0);
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent);
    expect(labels[0]).toMatch(/party/i);
    expect(labels[0]).toMatch(/Gatehouse/);
  });

  it('a plain pin offers only edit and remove', () => {
    const mr = makeMr();
    const menu = showPinContextMenu(mr, { id: 'pin-2', map_id: 'map-2', col: 2, row: 2, label: 'Gatehouse' }, 0, 0);
    const labels = [...menu.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent);
    expect(labels.some((l) => /party/i.test(l))).toBe(false);
  });

  it('the palette offers one command per door on the map', () => {
    const mr = makeMr();
    const ui = /** @type {any} */ ({ state: mr.state, mapRenderer: mr });
    const cmds = buildPaletteCommands(ui, { isGM: true, combatActive: false });
    const travel = cmds.filter((c) => c.id.startsWith('travel-'));
    expect(travel).toHaveLength(1);
    expect(travel[0].label).toMatch(/Gatehouse/);
  });

  it('keeps the trip away from a player', () => {
    const mr = makeMr({ isGM: false });
    const ui = /** @type {any} */ ({ state: mr.state, mapRenderer: mr });
    const cmds = buildPaletteCommands(ui, { isGM: false, combatActive: false });
    expect(cmds.filter((c) => c.id.startsWith('travel-'))).toHaveLength(0);
  });
});

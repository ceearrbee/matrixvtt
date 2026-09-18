/**
 * The three forms that read numbers without a validation pass.
 *
 * `FormReader.validate()` + `applyFieldErrors` give per-field messages,
 * `aria-invalid` and focus, and the entity forms have used them for a
 * while. These three called `collect()` straight through, so `getInt`'s
 * `parseInt(v) || 0` turned whatever it could not read into a real 0
 * and wrote it.
 *
 * Every one of these inputs is `type="number"`, so a browser never
 * hands back letters - it hands back "". The reachable bad inputs are
 * the CLEARED field and the out-of-range one, and the worst of them is
 * the map: a cleared Width wrote a map 0 cells across, which renders as
 * a zero-size canvas. The writer does not validate on the way out -
 * `validateMap` is only wired to incoming events - so nothing else
 * caught it.
 *
 * A blank stays "not set" where the form allows one. A number the form
 * needs, or one outside the bounds it declares, is an error on the
 * field, and nothing is written.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as v from 'valibot';
import { render, h } from 'preact';
import { submitMapForm, mapFormSchema } from '../ui/MapsPanel.jsx';
import { wizardStepSchema, buildCharacterFromWizardData } from '../ui/character-wizard.js';
import { AddTokenForm } from '../map/actions/tokens.js';
import { MAP_BOUNDS } from '../utils/schemas/world.js';

// type="number" throughout, exactly as MapForm renders them, so a value
// the browser would refuse cannot be smuggled in by the fixture.
function mapModal(values = {}) {
  const el = document.createElement('div');
  el.innerHTML = `
    <input id="map-name" value="${values.name ?? 'Crypt'}">
    <input type="number" id="map-width" value="${values.width ?? '20'}">
    <input type="number" id="map-height" value="${values.height ?? '20'}">
    <input type="number" id="map-cell-px" value="${values.cell ?? '40'}">
    <select id="map-grid-type"><option value="square" selected>sq</option></select>
    <input id="map-env-tint" value="">
    <select id="map-source-type"><option value="url" selected>url</option></select>
    <input id="map-url" value="mxc://x/y">`;
  document.body.appendChild(el);
  return el;
}

function makeUi() {
  return /** @type {any} */ ({
    state: { createMap: vi.fn().mockResolvedValue('m1'), updateMap: vi.fn().mockResolvedValue(undefined) },
    _toast: vi.fn(),
  });
}

describe('map form numbers', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('refuses a cleared Width instead of writing a map 0 cells across', async () => {
    const ui = makeUi();
    expect(await submitMapForm(ui, mapModal({ width: '' }), '__new__')).toBe(false);
    expect(ui.state.createMap).not.toHaveBeenCalled();
  });

  it('refuses a cleared Height the same way', async () => {
    const ui = makeUi();
    expect(await submitMapForm(ui, mapModal({ height: '' }), '__new__')).toBe(false);
    expect(ui.state.createMap).not.toHaveBeenCalled();
  });

  it('refuses a size past the bound the room schema sets', async () => {
    const ui = makeUi();
    const modal = mapModal({ width: String(MAP_BOUNDS.cells.max + 1) });
    expect(await submitMapForm(ui, modal, '__new__')).toBe(false);
    expect(ui.state.createMap).not.toHaveBeenCalled();
  });

  it('refuses a negative size, which the number input still allows', async () => {
    const ui = makeUi();
    expect(await submitMapForm(ui, mapModal({ cell: '-40' }), '__new__')).toBe(false);
    expect(ui.state.createMap).not.toHaveBeenCalled();
  });

  it('marks the offending field rather than only refusing', async () => {
    const modal = mapModal({ width: '' });
    await submitMapForm(makeUi(), modal, '__new__');
    expect(modal.querySelector('#map-width').getAttribute('aria-invalid')).toBe('true');
    expect(modal.querySelector('#map-width-error')?.textContent).toBeTruthy();
  });

  it('writes a map whose numbers read cleanly', async () => {
    const ui = makeUi();
    expect(await submitMapForm(ui, mapModal(), '__new__')).toBe(true);
    expect(ui.state.createMap.mock.calls[0][0])
      .toMatchObject({ width_cells: 20, height_cells: 20, cell_px: 40 });
  });

  it('takes its bounds from the same place the room-state schema does', () => {
    const over = v.safeParse(mapFormSchema(), {
      width_cells: MAP_BOUNDS.cells.max + 1, height_cells: 20, cell_px: 40,
    });
    expect(over.success).toBe(false);
  });
});

describe('quick add-token form numbers', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
  afterEach(() => { render(null, host); host.remove(); });

  function mr() {
    return /** @type {any} */ ({
      state: {
        settings: { systemConfig: { attributes: [], token: {} } },
        tokens: new Map(), activeMapId: 'm1',
        widgetManager: { userId: '@me:hs' },
        updateToken: vi.fn().mockResolvedValue(undefined),
      },
      render: vi.fn(),
    });
  }

  function submit(m, onClose, hp) {
    render(h(AddTokenForm, { mr: m, col: 1, row: 1, onClose }), host);
    host.querySelector('#token-name').value = 'Goblin';
    if (hp !== undefined) host.querySelector('#token-hp-max').value = hp;
    host.querySelector('#add-token-form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  it('refuses negative HP rather than seeding hp_current below zero', async () => {
    const m = mr();
    const onClose = vi.fn();
    submit(m, onClose, '-5');
    await Promise.resolve();
    expect(m.state.updateToken).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(host.querySelector('#token-hp-max').getAttribute('aria-invalid')).toBe('true');
  });

  it('still adds a token whose HP reads cleanly', async () => {
    const m = mr();
    submit(m, vi.fn(), '12');
    await Promise.resolve();
    await Promise.resolve();
    expect(m.state.updateToken).toHaveBeenCalled();
  });
});

describe('character wizard numbers', () => {
  const step = { id: 'stats', label: 'Ability Scores', fields: [
    { key: 'strength', label: 'Strength', type: 'int', min: 1, max: 20 },
  ] };

  it('holds a score to the bounds the step declares', () => {
    expect(v.safeParse(wizardStepSchema(step), { strength: 99 }).success).toBe(false);
    expect(v.safeParse(wizardStepSchema(step), { strength: 0 }).success).toBe(false);
    expect(v.safeParse(wizardStepSchema(step), { strength: 14 }).success).toBe(true);
  });

  it('leaves a blank score alone - the wizard fills its own defaults', () => {
    expect(v.safeParse(wizardStepSchema(step), {}).success).toBe(true);
  });

  it('asks nothing of a step with no numbers in it', () => {
    const names = { id: 'name', label: 'Name', fields: [{ key: 'name', label: 'Name', type: 'text' }] };
    expect(v.safeParse(wizardStepSchema(names), {}).success).toBe(true);
  });

  // The whole point of reporting a cleared number as null: every
  // `?? default` downstream was being beaten by getInt's 0, so a
  // player who cleared Strength got 0 instead of the sheet's 10.
  it('falls back to the sheet default when a score is left blank', () => {
    const c = buildCharacterFromWizardData({ name: 'Aria', strength: null }, 'dnd5e');
    expect(c.attributes.strength).toBe(10);
  });

  it('keeps a score the player actually typed', () => {
    const c = buildCharacterFromWizardData({ name: 'Aria', strength: 16 }, 'dnd5e');
    expect(c.attributes.strength).toBe(16);
  });
});

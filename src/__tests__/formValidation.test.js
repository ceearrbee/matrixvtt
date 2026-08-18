/**
 * Form-layer validation: validate(fields, schema) reads the DOM by id and
 * checks the collected object against a Valibot schema, returning
 * {values, errors} so forms can reject empty/required and out-of-range inputs
 * before they reach the Valibot writers (where the same error would only
 * surface as a far-away toast). Inline rendering is covered separately in the
 * applyFieldErrors tests.
 */
import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { FormReader, applyFieldErrors } from '../utils/forms.js';
import { getPCSchema, getNPCSchema, createNPC, createCharacter } from '../ui/entity/forms.js';
import { getItemFormSchema, createItem } from '../ui/items-tab.js';
import { getSpellFormSchema, createSpell } from '../ui/spells-tab.js';

function makeForm(html) {
  const form = document.createElement('form');
  form.innerHTML = html;
  document.body.appendChild(form);
  return form;
}

describe('FormReader.validate', () => {
  it('returns empty errors object on valid input', () => {
    const form = makeForm(`
      <input type="text" id="name" value="Sword">
      <input type="number" id="hp" value="10">
    `);
    const { values, errors } = new FormReader(form).validate(
      { name: { id: 'name' }, hp: { id: 'hp', type: 'int' } },
      v.object({
        name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
        hp: v.pipe(v.number(), v.minValue(1, 'HP must be at least 1')),
      }),
    );
    expect(errors).toEqual({});
    expect(values.name).toBe('Sword');
    expect(values.hp).toBe(10);
  });

  it('flags missing required fields', () => {
    const form = makeForm(`
      <input type="text" id="name" value="">
      <input type="number" id="hp" value="5">
    `);
    const { errors } = new FormReader(form).validate(
      { name: { id: 'name' }, hp: { id: 'hp', type: 'int' } },
      v.object({
        name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
        hp: v.pipe(v.number(), v.minValue(1, 'HP must be at least 1')),
      }),
    );
    expect(errors.name).toBeTruthy();
    expect(errors.name.toLowerCase()).toContain('required');
    expect(errors.hp).toBeUndefined();
  });

  it('flags below-min and above-max integers', () => {
    const form = makeForm(`
      <input type="number" id="ac" value="-1">
      <input type="number" id="speed" value="9999">
    `);
    const { errors } = new FormReader(form).validate(
      { ac: { id: 'ac', type: 'int' }, speed: { id: 'speed', type: 'int' } },
      v.object({
        ac: v.optional(v.pipe(v.number(), v.minValue(0, 'AC must be at least 0'), v.maxValue(40, 'AC must be at most 40'))),
        speed: v.optional(v.pipe(v.number(), v.minValue(0, 'Speed must be at least 0'), v.maxValue(200, 'Speed must be at most 200'))),
      }),
    );
    expect(errors.ac).toMatch(/at least 0/);
    expect(errors.speed).toMatch(/at most 200/);
  });

  it('treats blank required int as a required failure', () => {
    const form = makeForm(`<input type="number" id="hp" value="">`);
    const { errors } = new FormReader(form).validate(
      { hp: { id: 'hp', type: 'int' } },
      v.object({ hp: v.pipe(v.number('HP Max is required'), v.minValue(1, 'HP Max must be at least 1')) }),
    );
    expect(errors.hp).toBeTruthy();
    expect(errors.hp.toLowerCase()).toContain('required');
  });

  it('does not treat 0 as missing for non-required int', () => {
    const form = makeForm(`<input type="number" id="lvl" value="0">`);
    const { values, errors } = new FormReader(form).validate(
      { lvl: { id: 'lvl', type: 'int' } },
      v.object({ lvl: v.optional(v.pipe(v.number(), v.minValue(0, 'Level must be at least 0'), v.maxValue(9, 'Level must be at most 9'))) }),
    );
    expect(errors).toEqual({});
    expect(values.lvl).toBe(0);
  });

  it('legacy collect() still returns values-only', () => {
    const form = makeForm(`<input type="text" id="name" value="">`);
    const data = new FormReader(form).collect({
      name: { id: 'name' },
    });
    expect(data).toEqual({ name: null });
  });

  it('preserves bool coercion alongside validators', () => {
    const form = makeForm(`
      <input type="text" id="name" value="Fireball">
      <input type="checkbox" id="ritual">
    `);
    const { values, errors } = new FormReader(form).validate(
      { name: { id: 'name' }, ritual: { id: 'ritual', type: 'bool' } },
      v.object({ name: v.pipe(v.string(), v.minLength(1, 'Name is required')), ritual: v.boolean() }),
    );
    expect(errors).toEqual({});
    expect(values.ritual).toBe(false);
    expect(typeof values.ritual).toBe('boolean');
  });
});

describe('applyFieldErrors', () => {
  it('sets aria-invalid and inserts a role="alert" sibling for invalid fields', () => {
    const form = makeForm(`
      <input type="text" id="name">
      <input type="number" id="hp">
    `);
    applyFieldErrors(form, { name: 'Name is required' }, {
      name: { id: 'name' },
      hp:   { id: 'hp', type: 'int' },
    });

    const nameInput = form.querySelector('#name');
    expect(nameInput.getAttribute('aria-invalid')).toBe('true');
    expect(nameInput.getAttribute('aria-describedby')).toBe('name-error');
    expect(nameInput.classList.contains('field--invalid')).toBe(true);

    const alert = form.querySelector('#name-error');
    expect(alert).toBeTruthy();
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toBe('Name is required');

    // hp is not invalid → unchanged
    expect(form.querySelector('#hp').getAttribute('aria-invalid')).toBe(null);
  });

  it('clears stale errors on subsequent calls', () => {
    const form = makeForm(`<input type="text" id="name">`);
    const schema = { name: { id: 'name' } };
    applyFieldErrors(form, { name: 'Required' }, schema);
    expect(form.querySelector('#name-error')).toBeTruthy();

    applyFieldErrors(form, {}, schema);
    expect(form.querySelector('#name-error')).toBe(null);
    expect(form.querySelector('#name').getAttribute('aria-invalid')).toBe(null);
    expect(form.querySelector('#name').classList.contains('field--invalid')).toBe(false);
  });

  it('focuses the first invalid field', () => {
    const form = makeForm(`
      <input type="text" id="a">
      <input type="text" id="b">
    `);
    applyFieldErrors(form, { b: 'Bad', a: 'Bad' }, {
      a: { id: 'a' },
      b: { id: 'b' },
    });
    expect(document.activeElement.id).toBe('a');
  });

  it('handles multi-id fields by resolving the first matching input', () => {
    const form = makeForm(`<input type="text" id="entity-name">`);
    applyFieldErrors(form, { name: 'Required' }, {
      name: { ids: ['entity-name', 'char-name'] },
    });
    const input = form.querySelector('#entity-name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(form.querySelector('#entity-name-error')).toBeTruthy();
  });
});

describe('PC and NPC form schemas declare validation constraints', () => {
  it('PC schema requires name and hp_max, ranges ac/speed; field map carries int/bool types', () => {
    const { fields, schema } = getPCSchema();
    expect(fields.name).toMatchObject({ ids: ['entity-name', 'char-name'] });
    expect(fields.hp_max.type).toBe('int');
    expect(v.safeParse(schema, { name: '', hp_max: 1, ac: 10, speed: 30 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', hp_max: undefined, ac: 10, speed: 30 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', hp_max: 1, ac: 99, speed: 30 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', hp_max: 1, ac: 10, speed: 30 }).success).toBe(true);
  });

  it('NPC schema requires name and hp_max, ranges ac/speed; is_hidden is bool', () => {
    const { fields, schema } = getNPCSchema();
    expect(fields.is_hidden.type).toBe('bool');
    expect(v.safeParse(schema, { name: '', hp_max: 1, ac: 10, speed: 30 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', hp_max: undefined, ac: 10, speed: 30 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', hp_max: 1, ac: 99, speed: 30 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', hp_max: 1, ac: 10, speed: 30 }).success).toBe(true);
  });
});

describe('Item form schema declares validation constraints', () => {
  it('requires name and ranges quantity/weight/cost; field map carries int/float/bool types', () => {
    const { fields, schema } = getItemFormSchema();
    expect(fields.quantity.type).toBe('int');
    expect(fields.weight.type).toBe('float');
    expect(fields.equipped.type).toBe('bool');
    expect(v.safeParse(schema, { name: '', quantity: 1 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', quantity: -1 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', weight: -1 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', cost_gp: -1 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', quantity: 1, weight: 0, cost_gp: 0 }).success).toBe(true);
  });
});

describe('Spell form schema declares validation constraints', () => {
  it('requires name and ranges level 0..9; concentration/ritual are bool', () => {
    const { fields, schema } = getSpellFormSchema();
    expect(fields.concentration.type).toBe('bool');
    expect(fields.ritual.type).toBe('bool');
    expect(v.safeParse(schema, { name: '', level: 1 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', level: 10 }).success).toBe(false);
    expect(v.safeParse(schema, { name: 'A', level: 0 }).success).toBe(true);
  });
});

describe('createNPC integration: blank required blocks save', () => {
  function npcModal({ name = '', hp_max = '', ac = '10', speed = '30' } = {}) {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <input type="text" id="entity-name" value="${name}">
      <input type="text" id="entity-cr" value="1">
      <input type="text" id="entity-size" value="medium">
      <input type="number" id="entity-hp-max" value="${hp_max}">
      <input type="number" id="entity-ac" value="${ac}">
      <input type="number" id="entity-speed" value="${speed}">
      <input type="checkbox" id="entity-hidden">
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function makeUi() {
    const calls = [];
    return {
      calls,
      state: {
        npcs: new Map(),
        characters: new Map(),
        async updateNPC(id, content) { calls.push({ id, content }); },
        async updateCharacter(id, content) { calls.push({ id, content }); },
      },
      _collectAttributeValues: () => ({}),
      widgetManager: { userId: '@u:s', sendStateEvent: async () => {}, getRoomState: () => [] },
    };
  }

  it('blank HP-Max sets aria-invalid on input and does not call writer', async () => {
    const modal = npcModal({ name: 'Goblin', hp_max: '' });
    const ui = makeUi();
    const result = await createNPC(ui, modal);
    expect(result).toBe(false);
    expect(ui.calls.length).toBe(0);
    const hp = modal.querySelector('#entity-hp-max');
    expect(hp.getAttribute('aria-invalid')).toBe('true');
    expect(modal.querySelector('#entity-hp-max-error')).toBeTruthy();
  });

  it('blank name flags name field', async () => {
    const modal = npcModal({ name: '', hp_max: '5' });
    const ui = makeUi();
    const result = await createNPC(ui, modal);
    expect(result).toBe(false);
    expect(modal.querySelector('#entity-name').getAttribute('aria-invalid')).toBe('true');
  });

  it('AC out of range flags AC field', async () => {
    const modal = npcModal({ name: 'X', hp_max: '5', ac: '999' });
    const ui = makeUi();
    const result = await createNPC(ui, modal);
    expect(result).toBe(false);
    expect(modal.querySelector('#entity-ac').getAttribute('aria-invalid')).toBe('true');
    expect(modal.querySelector('#entity-ac-error').textContent).toMatch(/at most 40/);
  });

  it('valid input passes and calls writer', async () => {
    const modal = npcModal({ name: 'Orc', hp_max: '15' });
    const ui = makeUi();
    const result = await createNPC(ui, modal);
    expect(result).toBe(true);
    expect(ui.calls.length).toBe(1);
    expect(ui.calls[0].content.name).toBe('Orc');
    expect(ui.calls[0].content.hp_max).toBe(15);
  });
});

describe('createCharacter integration: blank required blocks save', () => {
  function pcModal({ name = '', hp_max = '' } = {}) {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <input type="text" id="entity-name" value="${name}">
      <input type="text" id="entity-species" value="">
      <input type="text" id="entity-class-level" value="">
      <input type="number" id="entity-hp-max" value="${hp_max}">
      <input type="number" id="entity-hp-current" value="">
      <input type="number" id="entity-ac" value="10">
      <input type="number" id="entity-speed" value="30">
      <input type="number" id="entity-initiative-bonus" value="">
      <textarea id="entity-notes"></textarea>
      <input type="text" id="entity-spellcasting-ability" value="">
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function makeUi() {
    const calls = [];
    return {
      calls,
      state: {
        npcs: new Map(),
        characters: new Map(),
        async updateNPC(id, c) { calls.push({ id, c }); },
        async updateCharacter(id, c) { calls.push({ id, c }); },
      },
      _collectAttributeValues: () => ({}),
      _collectSpellSlots: () => ({}),
      widgetManager: { userId: '@u:s', sendStateEvent: async () => {}, getRoomState: () => [] },
    };
  }

  it('blank PC name blocks save', async () => {
    const modal = pcModal({ name: '', hp_max: '20' });
    const ui = makeUi();
    const result = await createCharacter(ui, modal);
    expect(result).toBe(false);
    expect(ui.calls.length).toBe(0);
    expect(modal.querySelector('#entity-name').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('createItem integration', () => {
  function itemModal({ name = '', quantity = '1' } = {}) {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <input type="text" id="item-name" value="${name}">
      <input type="text" id="item-type" value="">
      <input type="number" id="item-quantity" value="${quantity}">
      <select id="item-rarity"><option value="common" selected>common</option></select>
      <textarea id="item-description"></textarea>
      <input type="number" id="item-weight" value="">
      <input type="number" id="item-cost" value="">
      <input type="number" id="item-attack" value="">
      <input type="text" id="item-damage" value="">
      <input type="text" id="item-damage-type" value="">
      <input type="text" id="item-properties" value="">
      <input type="checkbox" id="item-equipped">
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function makeUi() {
    const calls = [];
    return {
      calls,
      _toast: () => {},
      state: {
        items: new Map(),
        characters: new Map(),
        getCurrentCharacter: () => ({ id: 'c1', inventory_ids: [] }),
        getCurrentCharacterId: () => 'c1',
        canEditEntity: () => true,
        async updateItem(id, c) { calls.push({ id, c }); },
        async updateCharacter() {},
      },
      widgetManager: { userId: '@u:s', sendStateEvent: async () => {}, getRoomState: () => [] },
    };
  }

  it('negative quantity surfaces inline error and blocks save', async () => {
    const modal = itemModal({ name: 'Sword', quantity: '-3' });
    const ui = makeUi();
    const result = await createItem(ui, modal);
    expect(result).toBe(false);
    expect(ui.calls.length).toBe(0);
    expect(modal.querySelector('#item-quantity').getAttribute('aria-invalid')).toBe('true');
    expect(modal.querySelector('#item-quantity-error').textContent).toMatch(/at least 0/);
  });

  it('blank name surfaces inline error', async () => {
    const modal = itemModal({ name: '' });
    const ui = makeUi();
    const result = await createItem(ui, modal);
    expect(result).toBe(false);
    expect(modal.querySelector('#item-name').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('createSpell integration', () => {
  function spellModal({ name = '', level = '1' } = {}) {
    const modal = document.createElement('div');
    const opts = [0,1,2,3,4,5,6,7,8,9,10].map(l => `<option value="${l}">${l}</option>`).join('');
    modal.innerHTML = `
      <input type="text" id="spell-name" value="${name}">
      <select id="spell-level">${opts}</select>
      <select id="spell-school"><option value="Evocation" selected>Evocation</option></select>
      <input type="text" id="spell-casting-time" value="">
      <input type="text" id="spell-range" value="">
      <input type="text" id="spell-duration" value="">
      <input type="text" id="spell-components" value="">
      <textarea id="spell-description"></textarea>
      <input type="text" id="spell-damage" value="">
      <input type="text" id="spell-damage-type" value="">
      <input type="text" id="spell-save" value="">
      <input type="checkbox" id="spell-concentration">
      <input type="checkbox" id="spell-ritual">
      <textarea id="spell-higher-level"></textarea>
      <input type="text" id="spell-source" value="">
      <input type="text" id="spell-page" value="">
    `;
    document.body.appendChild(modal);
    modal.querySelector('#spell-level').value = String(level);
    return modal;
  }

  function makeUi() {
    const calls = [];
    return {
      calls,
      _toast: () => {},
      state: {
        spells: new Map(),
        characters: new Map(),
        getCurrentCharacter: () => ({ id: 'c1', spell_ids: [] }),
        getCurrentCharacterId: () => 'c1',
        canEditEntity: () => true,
        async updateSpell(id, c) { calls.push({ id, c }); },
        async updateCharacter() {},
      },
      widgetManager: { userId: '@u:s', sendStateEvent: async () => {}, getRoomState: () => [] },
    };
  }

  it('level out of range surfaces inline error', async () => {
    const modal = spellModal({ name: 'Boom', level: '10' });
    const ui = makeUi();
    const result = await createSpell(ui, modal);
    expect(result).toBe(false);
    expect(ui.calls.length).toBe(0);
    expect(modal.querySelector('#spell-level').getAttribute('aria-invalid')).toBe('true');
    expect(modal.querySelector('#spell-level-error').textContent).toMatch(/at most 9/);
  });

  it('blank name surfaces inline error', async () => {
    const modal = spellModal({ name: '', level: '1' });
    const ui = makeUi();
    const result = await createSpell(ui, modal);
    expect(result).toBe(false);
    expect(modal.querySelector('#spell-name').getAttribute('aria-invalid')).toBe('true');
  });
});

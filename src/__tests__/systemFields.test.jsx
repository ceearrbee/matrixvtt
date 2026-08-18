/**
 * Token and NPC creation forms follow the active ruleset: HP inputs
 * render only for systems whose harm model tracks HP, AC/Speed only
 * when the ruleset's character_form declares those fields, and the
 * attribute grid respects each attribute's min/max/default. A Risus
 * room must not offer HP Max 10 / AC 10 / cliché dice 10.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render } from 'preact';
import { rulesetTracksHP, rulesetHasFormField } from '../ui/entity-form/system-fields.js';
import { AttributeInputs } from '../ui/AttributeInputs.jsx';
import { showTokenFormModal } from '../ui/TokenFormModal.jsx';
import { showAddTokenDialog } from '../map/actions/tokens.js';
import risus from '../content/rulesets/risus.json';
import dnd5e from '../content/rulesets/dnd5e.json';
import gurps from '../content/rulesets/gurps.json';
import opend6 from '../content/rulesets/opend6.json';

describe('rulesetTracksHP', () => {
  it('matches each system harm model', () => {
    expect(rulesetTracksHP(dnd5e)).toBe(true);
    expect(rulesetTracksHP(gurps)).toBe(true);
    expect(rulesetTracksHP(opend6)).toBe(false);
    expect(rulesetTracksHP(risus)).toBe(false);
    expect(rulesetTracksHP(undefined)).toBe(true);
  });
});

describe('rulesetHasFormField', () => {
  it('reads ids out of character_form rows', () => {
    expect(rulesetHasFormField(dnd5e, 'ac')).toBe(true);
    expect(rulesetHasFormField(dnd5e, 'speed')).toBe(true);
    expect(rulesetHasFormField(risus, 'ac')).toBe(false);
    expect(rulesetHasFormField(undefined, 'ac')).toBe(true);
  });
});

describe('AttributeInputs bounds', () => {
  function mount(systemConfig) {
    const ui = /** @type {any} */ ({ state: { settings: { systemConfig } } });
    const host = document.createElement('div');
    render(h(AttributeInputs, { ui, existing: {} }), host);
    return host;
  }

  it('uses the ruleset min/max and defaults to min when 10 is out of range', () => {
    const host = mount(risus);
    const input = /** @type {HTMLInputElement} */ (host.querySelector('#entity-attr-cliche1'));
    expect(input.value).toBe('0');
    expect(input.min).toBe('0');
    expect(input.max).toBe('6');
  });

  it('keeps 10 as the default when it fits the declared range', () => {
    const host = mount(dnd5e);
    const input = /** @type {HTMLInputElement} */ (host.querySelector('#entity-attr-str'));
    expect(input.value).toBe('10');
    expect(input.min).toBe('1');
    expect(input.max).toBe('30');
  });
});

describe('TokenFormModal system fields', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  function open(systemConfig) {
    const ui = /** @type {any} */ ({
      state: {
        settings: { systemConfig },
        tokens: new Map(),
        characters: new Map(),
        npcs: new Map(),
        createToken: vi.fn(),
        updateToken: vi.fn(),
      },
      _toast: vi.fn(),
    });
    showTokenFormModal(ui);
    return document.body;
  }

  it('hides HP and AC inputs for systems without them (Risus)', () => {
    const body = open(risus);
    expect(body.querySelector('#token-name')).toBeTruthy();
    expect(body.querySelector('#token-hp-max')).toBeFalsy();
    expect(body.querySelector('#token-hp-current')).toBeFalsy();
    expect(body.querySelector('#token-ac')).toBeFalsy();
  });

  it('keeps HP and AC inputs for d20 systems', () => {
    const body = open(dnd5e);
    expect(body.querySelector('#token-hp-max')).toBeTruthy();
    expect(body.querySelector('#token-ac')).toBeTruthy();
  });
});

describe('map quick Add Token dialog', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  function open(systemConfig) {
    const mr = /** @type {any} */ ({
      state: {
        settings: { systemConfig },
        tokens: new Map(),
        activeMapId: 'm1',
        widgetManager: { userId: '@gm:s' },
      },
    });
    showAddTokenDialog(mr, 2, 3);
    return document.body;
  }

  it('omits HP/AC for Risus but keeps name and type', () => {
    const body = open(risus);
    expect(body.querySelector('#token-name')).toBeTruthy();
    expect(body.querySelector('#token-type')).toBeTruthy();
    expect(body.querySelector('#token-hp-max')).toBeFalsy();
    expect(body.querySelector('#token-ac')).toBeFalsy();
  });

  it('keeps HP/AC for d20 systems', () => {
    const body = open(dnd5e);
    expect(body.querySelector('#token-hp-max')).toBeTruthy();
    expect(body.querySelector('#token-ac')).toBeTruthy();
  });
});

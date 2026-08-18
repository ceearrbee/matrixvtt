/**
 * UIController - state-write error handling
 *
 * Tests that methods which call state.sendStateEvent() dispatch a vtt:error
 * event when the send fails, instead of silently swallowing the error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMinimalUI } from '../ui/ui-methods.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class { constructor() {} render() {} destroy() {} }
}));

vi.mock('../utils/ui-helpers.js', () => ({
  getHPPercentage: vi.fn(() => 50),
  getHPColor: vi.fn(() => '#1D9E75'),
  FormReader: class {
    constructor() {}
    getField(..._args) { return ''; }
    getInt(..._args) { return 0; }
    getCheckbox(..._args) { return false; }
    collect(schema) {
      const data = {};
      for (const prop of Object.keys(schema)) {
        data[prop] = '';
      }
      return data;
    }
    validate(fields) {
      const values = {};
      for (const [prop, config] of Object.entries(fields)) {
        const type = (config && config.type) || 'text';
        if (type === 'int' || type === 'float') values[prop] = 1;
        else if (type === 'bool') values[prop] = false;
        else values[prop] = 'mock-value';
      }
      return { values, errors: {} };
    }
  },
  applyFieldErrors: vi.fn(),
  ModalFactory: {
    create: vi.fn(({ body }) => {
      const el = document.createElement('div');
      el.innerHTML = body;
      return el;
    }),
    confirm: vi.fn()
  },
  trapFocusIn: vi.fn(() => () => {}),
}));

vi.mock('../utils/errorHandling.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

// Delete flows now route confirmation through confirm-dialogs.jsx (not the
// old ModalFactory.confirm). Mock it so tests can capture the confirm
// callback and invoke the destructive branch directly.
vi.mock('../ui/confirm-dialogs.jsx', () => ({
  confirm: vi.fn(),
  confirmAsync: vi.fn(),
  confirmTyped: vi.fn(),
}));
import { confirm as confirmMock } from '../ui/confirm-dialogs.jsx';

function makeInitiativeState(overrides = {}) {
  return {
    active: true,
    order: [
      { id: 'e1', character_id: 'c1', initiative: 20, name: 'A', token_id: 't1' },
      { id: 'e2', character_id: 'c2', initiative: 15, name: 'B', token_id: 't2' },
    ],
    current_index: 0,
    round: 1,
    ...overrides,
  };
}

/** Extend a test-state stub with the facade writer methods used by UI code. */
function withFacade(state) {
  const s = state.sendStateEvent;
  state.characters = state.characters ?? new Map();
  state.npcs = state.npcs ?? new Map();
  state.items = state.items ?? new Map();
  state.spells = state.spells ?? new Map();
  state.tokens = state.tokens ?? new Map();
  state.handouts = state.handouts ?? new Map();
  state.tables = state.tables ?? new Map();
  state.updateCharacter = async (id, c) => { state.characters.set(id, c); return s('com.vtt.character', id, c); };
  state.removeCharacter = async (id) => { state.characters.delete(id); return s('com.vtt.character', id, {}); };
  state.updateNPC = async (id, n) => { state.npcs.set(id, n); return s('com.vtt.npc', id, n); };
  state.removeNPC = async (id) => { state.npcs.delete(id); return s('com.vtt.npc', id, {}); };
  state.updateItem = async (id, i) => { state.items.set(id, i); return s('com.vtt.item', id, i); };
  state.removeItem = async (id) => { state.items.delete(id); return s('com.vtt.item', id, {}); };
  state.updateSpell = async (id, sp) => { state.spells.set(id, sp); return s('com.vtt.spell', id, sp); };
  state.removeSpell = async (id) => { state.spells.delete(id); return s('com.vtt.spell', id, {}); };
  state.updateToken = async (id, t) => { state.tokens.set(id, t); return s('com.vtt.token', id, t); };
  state.removeHandout = async (id) => { state.handouts.delete(id); return s('com.vtt.handout', id, {}); };
  state.removeTable = async (id) => { state.tables.delete(id); return s('com.vtt.table', id, {}); };
  state.updateSettings = async (next) => { state.settings = next; return s('com.vtt.settings', '', next); };
  state.updateInitiative = async (i) => { state.initiative = i; return s('com.vtt.initiative', '', i); };
  state.clearInitiative = async () => {
    state.initiative = { active: false, round: 0, current_index: 0, order: [] };
    return s('com.vtt.initiative', '', state.initiative);
  };
  return state;
}

function makeUI(sendStateEvent) {
  const state = withFacade({
    initiative: makeInitiativeState(),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    isGM: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  });
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.updateHeader = vi.fn();
  ui.updateInitiativePanel = vi.fn();
  return { ui, state };
}

// Helper to build the settings form modal DOM
function makeSettingsModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <form id="settings-form">
      <input id="settings-name" value="My Campaign">
      <select id="settings-system"><option value="dnd5e" selected>D&amp;D 5e</option></select>
      <input id="settings-grid" value="40">
      <input id="settings-gms" value="">
      <input id="announce-damage" type="checkbox">
      <input id="announce-combat" type="checkbox">
      <input id="announce-map" type="checkbox">
      <input id="perf-typing" type="checkbox">
      <input id="perf-drag" type="checkbox">
      <input id="perf-announcements" type="checkbox">
    </form>
  `;
  document.body.appendChild(modal);
  return modal;
}

describe('UIController.openSettings form submit - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects in settings save', async () => {
    const { ui } = makeUI(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    const onError = (e) => errors.push(e.detail);
    window.addEventListener('vtt:error', onError);

    ui.state.constructor = { getGameSystemPresets: vi.fn().mockReturnValue({ dnd5e: { name: 'D&D 5e' } }) };
    ui.openSettings();

    const form = document.querySelector('#settings-form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 10));

    window.removeEventListener('vtt:error', onError);
    expect(errors).toHaveLength(1);
  });
});

describe('UIController.reorderInitiative - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUI(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.reorderInitiative(0, 1);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUI(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.reorderInitiative(0, 1)).resolves.not.toThrow();
  });
});

// ─── toggleSpellPrepared ─────────────────────────────────────────────────────

function makeUIWithSpell(sendStateEvent) {
  const spellId = 'spell-1';
  const state = withFacade({
    spells: new Map([[spellId, { id: spellId, name: 'Fireball', level: 3, prepared: false }]]),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    getCurrentCharacter: vi.fn().mockReturnValue({ id: 'c1', owner_user_id: '@gm:s' }),
    canEditEntity: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  });
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui, spellId };
}

describe('UIController.toggleSpellPrepared - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui, spellId } = makeUIWithSpell(vi.fn().mockRejectedValue(new Error('network')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.toggleSpellPrepared(spellId);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui, spellId } = makeUIWithSpell(vi.fn().mockRejectedValue(new Error('network')));

    await expect(ui.toggleSpellPrepared(spellId)).resolves.not.toThrow();
  });
});

// ─── toggleEquipItem ─────────────────────────────────────────────────────────

function makeUIWithItem(sendStateEvent) {
  const itemId = 'item-1';
  const state = withFacade({
    items: new Map([[itemId, { id: itemId, name: 'Sword', equipped: false }]]),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    getCurrentCharacter: vi.fn().mockReturnValue({ id: 'c1', owner_user_id: '@gm:s' }),
    canEditEntity: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  });
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui, itemId };
}

describe('UIController.toggleEquipItem - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui, itemId } = makeUIWithItem(vi.fn().mockRejectedValue(new Error('network')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.toggleEquipItem(itemId);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui, itemId } = makeUIWithItem(vi.fn().mockRejectedValue(new Error('network')));

    await expect(ui.toggleEquipItem(itemId)).resolves.not.toThrow();
  });
});

// ─── deleteSkillOverride ─────────────────────────────────────────────────────

function makeUIWithCharacter(sendStateEvent) {
  const charId = 'char-1';
  const character = {
    id: charId,
    name: 'Aria',
    type: 'pc',
    owner_user_id: '@gm:s',
    skills: { athletics: { proficiency: 'proficient' } },
  };
  const state = withFacade({
    characters: new Map([[charId, character]]),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    getCurrentCharacter: vi.fn().mockReturnValue(character),
    getCurrentCharacterId: vi.fn().mockReturnValue(charId),
    canEditEntity: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  });
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui, charId };
}

describe('UIController.deleteSkillOverride - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; confirmMock.mockClear(); });

  // deleteSkillOverride now opens a confirm modal first; the error
  // path runs inside the user-clicks-Delete branch (the second arg to
  // confirm). confirm-dialogs is mocked at the top of this file, so we
  // reach the callback through .mock.calls.
  async function runConfirmCallback() {
    const callback = confirmMock.mock.calls.at(-1)[1];
    await callback();
  }

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIWithCharacter(vi.fn().mockRejectedValue(new Error('network')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    ui.deleteSkillOverride('athletics');
    await runConfirmCallback();

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIWithCharacter(vi.fn().mockRejectedValue(new Error('network')));

    ui.deleteSkillOverride('athletics');
    await expect(runConfirmCallback()).resolves.not.toThrow();
  });
});

// ─── endCombat ───────────────────────────────────────────────────────────────

import { ModalFactory } from '../utils/ui-helpers.js';

function makeUIForEndCombat(sendStateEvent) {
  const state = withFacade({
    initiative: { active: true, round: 1, current_index: 0, order: [] },
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    isGM: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  });
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.updateHeader = vi.fn();
  ui.updateInitiativePanel = vi.fn();
  return { ui, state };
}

describe('UIController.endCombat - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('dispatches vtt:error when sendStateEvent rejects inside modal callback', async () => {
    const { ui } = makeUIForEndCombat(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    ui.endCombat();
    // Invoke the modal confirm callback directly
    const callback = confirmMock.mock.calls[0][1];
    await callback();

    expect(errors).toHaveLength(1);
  });

  it('does not throw inside modal callback when sendStateEvent rejects', async () => {
    const { ui } = makeUIForEndCombat(vi.fn().mockRejectedValue(new Error('forbidden')));

    ui.endCombat();
    const callback = confirmMock.mock.calls[0][1];

    await expect(callback()).resolves.not.toThrow();
  });
});

// ─── createCharacter ─────────────────────────────────────────────────────────

function makeUIForCharacterCreate(sendStateEvent) {
  const state = {
    characters: new Map(),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    settings: { gm_user_ids: [], system: 'generic', gameSystemPresets: null },
    roomMembers: [],
  };
  const widgetManager = { isStandalone: true, userId: '@gm:s' };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui, state };
}

function makeCharacterModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <input id="entity-name" value="Aria">
    <input id="entity-species" value="Human">
    <input id="entity-class" value="Wizard 5">
    <input id="entity-hp-current" value="32" type="number">
    <input id="entity-hp-max" value="32" type="number">
    <input id="entity-ac" value="14" type="number">
    <input id="entity-initiative" value="2" type="number">
    <input id="entity-speed" value="30" type="number">
    <input id="entity-skills" value="">
  `;
  document.body.appendChild(modal);
  return modal;
}

describe('UIController.createCharacter - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForCharacterCreate(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeCharacterModal();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.createCharacter(modal);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForCharacterCreate(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeCharacterModal();

    await expect(ui.createCharacter(modal)).resolves.not.toThrow();
  });
});

// ─── createToken ─────────────────────────────────────────────────────────────

function makeUIForCreateToken(sendStateEvent) {
  const state = {
    tokens: new Map(),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    roomMembers: [],
    settings: { gm_user_ids: [] },
    activeMapId: 'map-test',
  };
  const widgetManager = { isStandalone: true, userId: '@gm:s' };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.updateMapPanel = vi.fn();
  return { ui };
}

const tokenData = {
  name: 'Goblin', type: 'npc', color: '#f00',
  map_id: 'map-test',
  col: 2, row: 3, hp_current: 10, hp_max: 10, ac: 12,
  size: 1, image_url: null, aura_radius: 0, aura_color: '#4a9eff',
};

describe('UIController.createToken - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForCreateToken(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.createToken(tokenData);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForCreateToken(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.createToken(tokenData)).resolves.not.toThrow();
  });
});

// ─── createNPC ───────────────────────────────────────────────────────────────

function makeUIForNPCCreate(sendStateEvent) {
  const state = {
    npcs: new Map(),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    settings: { gm_user_ids: [] },
    roomMembers: [],
  };
  const widgetManager = { isStandalone: true, userId: '@gm:s' };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui, state };
}

function makeNPCModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <input id="entity-name" value="Goblin">
    <input id="entity-cr" value="1/4">
    <input id="entity-size" value="Small">
    <input id="entity-hp-max" value="7" type="number">
    <input id="entity-ac" value="12" type="number">
    <input id="entity-speed" value="30" type="number">
    <input type="checkbox" id="entity-hidden">
  `;
  document.body.appendChild(modal);
  return modal;
}

describe('UIController.createNPC - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForNPCCreate(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeNPCModal();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.createNPC(modal);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForNPCCreate(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeNPCModal();

    await expect(ui.createNPC(modal)).resolves.not.toThrow();
  });
});

// ─── _createNPCFromTemplate ──────────────────────────────────────────────────

const npcTemplate = {
  name: 'Goblin', cr: '1/4', size_category: 'Small',
  hp_max: 7, ac: 12, speed: 30,
  attributes: {}, actions: [],
};

describe('UIController._createNPCFromTemplate - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForNPCCreate(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui._createNPCFromTemplate(npcTemplate);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForNPCCreate(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui._createNPCFromTemplate(npcTemplate)).resolves.not.toThrow();
  });
});

// ─── toggleSpellSlotPip ──────────────────────────────────────────────────────

function makeUIForSpellSlot(sendStateEvent) {
  const charId = 'char-1';
  const character = { id: charId, owner_user_id: '@gm:s', spell_slots: { '1': { total: 4, used: 1 } } };
  const state = withFacade({
    characters: new Map([[charId, character]]),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    getCurrentCharacter: vi.fn().mockReturnValue(character),
    getCurrentCharacterId: vi.fn().mockReturnValue(charId),
    canEditEntity: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  });
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui };
}

describe('UIController.toggleSpellSlotPip - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForSpellSlot(vi.fn().mockRejectedValue(new Error('network')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.toggleSpellSlotPip(1, 0, 1, 4);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForSpellSlot(vi.fn().mockRejectedValue(new Error('network')));

    await expect(ui.toggleSpellSlotPip(1, 0, 1, 4)).resolves.not.toThrow();
  });
});

// ─── showAddSkillOverrideForm ────────────────────────────────────────────────

describe('UIController.showAddSkillOverrideForm - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  // The form is now a Preact <Modal> rendered into the document; drive it
  // by filling the real inputs and submitting the real form.
  async function submitSkillForm() {
    const form = document.querySelector('#skill-override-form');
    form.querySelector('#skill-key').value = 'athletics';
    form.querySelector('#skill-bonus').value = '5';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    // Flush the async submit handler + any pending error dispatch.
    await new Promise((r) => setTimeout(r, 0));
  }

  it('dispatches vtt:error when sendStateEvent rejects inside form submit', async () => {
    const { ui } = makeUIWithCharacter(vi.fn().mockRejectedValue(new Error('network')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    ui.showAddSkillOverrideForm();
    await submitSkillForm();

    expect(errors).toHaveLength(1);
  });

  it('does not throw inside form submit when sendStateEvent rejects', async () => {
    const { ui } = makeUIWithCharacter(vi.fn().mockRejectedValue(new Error('network')));

    ui.showAddSkillOverrideForm();
    await expect(submitSkillForm()).resolves.not.toThrow();
  });
});

// ─── cycleSkillProficiency ───────────────────────────────────────────────────

describe('UIController.cycleSkillProficiency - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIWithCharacter(vi.fn().mockRejectedValue(new Error('network')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.cycleSkillProficiency('athletics');

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIWithCharacter(vi.fn().mockRejectedValue(new Error('network')));

    await expect(ui.cycleSkillProficiency('athletics')).resolves.not.toThrow();
  });
});

// ─── createSpell / updateSpell / deleteSpell ─────────────────────────────────

function makeUIForSpellForm(sendStateEvent) {
  const charId  = 'char-1';
  const spellId = 'spell-1';
  const character = { id: charId, owner_user_id: '@gm:s', spell_ids: [spellId] };
  const spell = { id: spellId, name: 'Fireball', level: 3, school: 'Evocation', prepared: false };
  const state = {
    spells: new Map([[spellId, spell]]),
    characters: new Map([[charId, character]]),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    getCurrentCharacter: vi.fn().mockReturnValue(character),
    getCurrentCharacterId: vi.fn().mockReturnValue(charId),
    canEditEntity: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  };
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui, spellId };
}

function makeSpellModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <input id="spell-name" value="Fireball">
    <input id="spell-level" value="3" type="number">
    <input id="spell-school" value="Evocation">
    <input id="spell-casting-time" value="1 action">
    <input id="spell-range" value="150 ft">
    <input id="spell-duration" value="Instantaneous">
    <input id="spell-components" value="V, S, M">
    <textarea id="spell-description">A bright streak...</textarea>
    <input id="spell-damage" value="8d6">
    <input id="spell-damage-type" value="fire">
    <input id="spell-save" value="dex">
  `;
  document.body.appendChild(modal);
  return modal;
}

describe('UIController.createSpell - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForSpellForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeSpellModal();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.createSpell(modal);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForSpellForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeSpellModal();

    await expect(ui.createSpell(modal)).resolves.not.toThrow();
  });
});

describe('UIController.updateSpell - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui, spellId } = makeUIForSpellForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeSpellModal();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.updateSpell(modal, spellId);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui, spellId } = makeUIForSpellForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeSpellModal();

    await expect(ui.updateSpell(modal, spellId)).resolves.not.toThrow();
  });
});

describe('UIController.deleteSpell - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('dispatches vtt:error when sendStateEvent rejects inside modal callback', async () => {
    const { ui, spellId } = makeUIForSpellForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    ui.deleteSpell(spellId);
    const callback = confirmMock.mock.calls[0][1];
    await callback();

    expect(errors).toHaveLength(1);
  });

  it('does not throw inside modal callback when sendStateEvent rejects', async () => {
    const { ui, spellId } = makeUIForSpellForm(vi.fn().mockRejectedValue(new Error('forbidden')));

    ui.deleteSpell(spellId);
    const callback = confirmMock.mock.calls[0][1];

    await expect(callback()).resolves.not.toThrow();
  });
});

// ─── claimCharacter / unclaimCharacter ───────────────────────────────────────

function makeUIForClaim(sendStateEvent) {
  const charId = 'char-1';
  const character = { id: charId, name: 'Aria', claimed_by_user_id: null, type: 'pc' };
  const state = {
    characters: new Map([[charId, character]]),
    tokens: new Map(),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    isGM: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  };
  const widgetManager = { isStandalone: true, userId: '@gm:s' };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui, charId };
}

describe('UIController.claimCharacter - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('dispatches vtt:error when sendStateEvent rejects inside modal callback', async () => {
    const { ui, charId } = makeUIForClaim(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    ui.claimCharacter(charId);
    const callback = confirmMock.mock.calls[0][1];
    await callback();

    expect(errors).toHaveLength(1);
  });

  it('does not throw inside modal callback when sendStateEvent rejects', async () => {
    const { ui, charId } = makeUIForClaim(vi.fn().mockRejectedValue(new Error('forbidden')));

    ui.claimCharacter(charId);
    const callback = confirmMock.mock.calls[0][1];

    await expect(callback()).resolves.not.toThrow();
  });
});

describe('UIController.unclaimCharacter - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const charId = 'char-1';
    const character = { id: charId, name: 'Aria', claimed_by_user_id: '@gm:s', type: 'pc' };
    const state = {
      characters: new Map([[charId, character]]),
      tokens: new Map(),
      sendStateEvent: vi.fn().mockRejectedValue(new Error('forbidden')),
      isGM: vi.fn().mockReturnValue(true),
      roomMembers: [],
      settings: { gm_user_ids: [] },
    };
    const widgetManager = { isStandalone: true, userId: '@gm:s' };
    const ui = createMinimalUI(state, widgetManager, null);
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.unclaimCharacter(charId);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const charId = 'char-1';
    const character = { id: charId, name: 'Aria', claimed_by_user_id: '@gm:s', type: 'pc' };
    const state = {
      characters: new Map([[charId, character]]),
      tokens: new Map(),
      sendStateEvent: vi.fn().mockRejectedValue(new Error('forbidden')),
      isGM: vi.fn().mockReturnValue(true),
      roomMembers: [],
      settings: { gm_user_ids: [] },
    };
    const widgetManager = { isStandalone: true, userId: '@gm:s' };
    const ui = createMinimalUI(state, widgetManager, null);

    await expect(ui.unclaimCharacter(charId)).resolves.not.toThrow();
  });
});

// ─── createItem / deleteItem ─────────────────────────────────────────────────

function makeUIForItemForm(sendStateEvent) {
  const charId = 'char-1';
  const itemId = 'item-1';
  const character = { id: charId, owner_user_id: '@gm:s', inventory_ids: [itemId] };
  const item = { id: itemId, name: 'Sword', type: 'Weapon', equipped: false };
  const state = {
    items: new Map([[itemId, item]]),
    characters: new Map([[charId, character]]),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    getCurrentCharacter: vi.fn().mockReturnValue(character),
    getCurrentCharacterId: vi.fn().mockReturnValue(charId),
    canEditEntity: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  };
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  return { ui, itemId };
}

function makeItemModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <input id="item-name" value="Sword">
    <input id="item-type" value="Weapon">
    <input id="item-quantity" value="1" type="number">
    <input id="item-rarity" value="Common">
    <textarea id="item-description"></textarea>
    <input id="item-attack" value="5" type="number">
    <input id="item-damage" value="1d8">
    <input id="item-damage-type" value="slashing">
    <input id="item-properties" value="Versatile">
    <input id="item-equipped" type="checkbox">
  `;
  document.body.appendChild(modal);
  return modal;
}

describe('UIController.createItem - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForItemForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeItemModal();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.createItem(modal);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForItemForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeItemModal();

    await expect(ui.createItem(modal)).resolves.not.toThrow();
  });
});

describe('UIController.deleteItem - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('dispatches vtt:error when sendStateEvent rejects inside modal callback', async () => {
    const { ui, itemId } = makeUIForItemForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    ui.deleteItem(itemId);
    const callback = confirmMock.mock.calls[0][1];
    await callback();

    expect(errors).toHaveLength(1);
  });

  it('does not throw inside modal callback when sendStateEvent rejects', async () => {
    const { ui, itemId } = makeUIForItemForm(vi.fn().mockRejectedValue(new Error('forbidden')));

    ui.deleteItem(itemId);
    const callback = confirmMock.mock.calls[0][1];

    await expect(callback()).resolves.not.toThrow();
  });
});

// ─── adjustXP ────────────────────────────────────────────────────────────────

function makeUIForAdjustXP(sendStateEvent) {
  const charId = 'char-1';
  const character = { id: charId, name: 'Aria', level: 1, xp_current: 0, xp_next_level: 300 };
  const state = {
    characters: new Map([[charId, character]]),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    isGM: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  };
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.updateSheetPanel = vi.fn();
  return { ui, charId };
}

describe('UIController.adjustXP - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui, charId } = makeUIForAdjustXP(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.adjustXP(charId, 100);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui, charId } = makeUIForAdjustXP(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.adjustXP(charId, 100)).resolves.not.toThrow();
  });
});

// ─── updateToken / updateCharacter / updateNPC ────────────────────────────────

function makeUIForUpdateToken(sendStateEvent) {
  const tokenId = 'tok-1';
  const token = { id: tokenId, name: 'Goblin', type: 'npc', col: 0, row: 0, hp_current: 7, hp_max: 7, ac: 12, size: 1, image_url: null, aura_radius: 0, aura_color: '#4a9eff', color: '#f00', conditions: [], sheet_id: null, owner_user_id: null };
  const state = {
    tokens: new Map([[tokenId, token]]),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  };
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.updateMapPanel = vi.fn();
  return { ui, tokenId };
}

describe('UIController.updateToken - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui, tokenId } = makeUIForUpdateToken(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.updateToken(tokenId, tokenData);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui, tokenId } = makeUIForUpdateToken(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.updateToken(tokenId, tokenData)).resolves.not.toThrow();
  });
});

describe('UIController.updateItem - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui, itemId } = makeUIForItemForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeItemModal();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.updateItem(modal, itemId);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui, itemId } = makeUIForItemForm(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeItemModal();

    await expect(ui.updateItem(modal, itemId)).resolves.not.toThrow();
  });
});

// ─── initiative turn methods ─────────────────────────────────────────────────

function makeUIForInitiative(sendStateEvent) {
  const state = withFacade({
    initiative: makeInitiativeState(),
    tokens: new Map([['t1', { id: 't1', name: 'A', sheet_id: null, initiative_bonus: 0 }]]),
    characters: new Map(),
    npcs: new Map(),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    isGM: vi.fn().mockReturnValue(true),
    roomMembers: [],
    settings: { gm_user_ids: [] },
  });
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.updateHeader = vi.fn();
  ui.updateInitiativePanel = vi.fn();
  // diceRoller must exist for rollInitiative
  ui.diceRoller = { roll: vi.fn().mockReturnValue({ result: 12 }) };
  return { ui };
}

describe('UIController.rollInitiative - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    // rollInitiative now opens a mode-selection modal when called without a
    // mode; pass the mode directly to exercise the same send path.
    await ui.rollInitiative('randomize');

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.rollInitiative('randomize')).resolves.not.toThrow();
  });
});

describe('UIController.nextTurn - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.nextTurn();

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.nextTurn()).resolves.not.toThrow();
  });
});

describe('UIController.prevTurn - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.prevTurn();

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.prevTurn()).resolves.not.toThrow();
  });
});

describe('UIController.setTurn - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.setTurn(0);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.setTurn(0)).resolves.not.toThrow();
  });
});

// ─── addTokenToInitiative ────────────────────────────────────────────────────

describe('UIController.addTokenToInitiative - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.addTokenToInitiative('t1');

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIForInitiative(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.addTokenToInitiative('t1')).resolves.not.toThrow();
  });
});

// ─── placeSheetOnMap ─────────────────────────────────────────────────────────

function makeUIForPlaceSheet(sendStateEvent) {
  const charId = 'char-1';
  const character = { id: charId, name: 'Aria', hp_current: 32, hp_max: 32, ac: 14, claimed_by_user_id: null };
  const send = sendStateEvent ?? vi.fn().mockResolvedValue(undefined);
  const state = {
    characters: new Map([[charId, character]]),
    npcs: new Map(),
    tokens: new Map(),
    sendStateEvent: send,
    updateToken: (id, token) => send('m.token', id, token),
    activeMapId: 'map-1',
    map: null,
    roomMembers: [],
    settings: { gm_user_ids: [] },
  };
  const widgetManager = { isStandalone: true, userId: '@gm:s' };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.updateSheetPanel = vi.fn();
  return { ui, charId };
}

describe('UIController.placeSheetOnMap - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui, charId } = makeUIForPlaceSheet(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.placeSheetOnMap(charId, 'pc');

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui, charId } = makeUIForPlaceSheet(vi.fn().mockRejectedValue(new Error('forbidden')));

    await expect(ui.placeSheetOnMap(charId, 'pc')).resolves.not.toThrow();
  });
});

// ─── deleteCharacter / deleteNPC ─────────────────────────────────────────────

function makeUIForDeleteEntity(sendStateEvent) {
  const charId = 'char-1';
  const npcId  = 'npc-1';
  const character = { id: charId, name: 'Aria' };
  const npc = { id: npcId, name: 'Goblin' };
  const state = {
    characters: new Map([[charId, character]]),
    npcs: new Map([[npcId, npc]]),
    tokens: new Map(),
    sendStateEvent: sendStateEvent ?? vi.fn().mockResolvedValue(undefined),
    selectedNPCId: npcId,
    roomMembers: [],
    settings: { gm_user_ids: [] },
  };
  const widgetManager = { isStandalone: true };
  const ui = createMinimalUI(state, widgetManager, null);
  ui.updateSheetPanel = vi.fn();
  return { ui, charId, npcId };
}

describe('UIController.deleteCharacter - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('dispatches vtt:error when sendStateEvent rejects inside modal callback', async () => {
    const { ui, charId } = makeUIForDeleteEntity(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    ui.deleteCharacter(charId);
    const callback = confirmMock.mock.calls[0][1];
    await callback();

    expect(errors).toHaveLength(1);
  });

  it('does not throw inside modal callback when sendStateEvent rejects', async () => {
    const { ui, charId } = makeUIForDeleteEntity(vi.fn().mockRejectedValue(new Error('forbidden')));

    ui.deleteCharacter(charId);
    const callback = confirmMock.mock.calls[0][1];

    await expect(callback()).resolves.not.toThrow();
  });
});

describe('UIController.deleteNPC - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('dispatches vtt:error when sendStateEvent rejects inside modal callback', async () => {
    const { ui, npcId } = makeUIForDeleteEntity(vi.fn().mockRejectedValue(new Error('forbidden')));
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    ui.deleteNPC(npcId);
    const callback = confirmMock.mock.calls[0][1];
    await callback();

    expect(errors).toHaveLength(1);
  });

  it('does not throw inside modal callback when sendStateEvent rejects', async () => {
    const { ui, npcId } = makeUIForDeleteEntity(vi.fn().mockRejectedValue(new Error('forbidden')));

    ui.deleteNPC(npcId);
    const callback = confirmMock.mock.calls[0][1];

    await expect(callback()).resolves.not.toThrow();
  });
});

describe('UIController.updateCharacter - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui } = makeUIWithCharacter(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeCharacterModal();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.updateCharacter(modal, 'char-1');

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui } = makeUIWithCharacter(vi.fn().mockRejectedValue(new Error('forbidden')));
    const modal = makeCharacterModal();

    await expect(ui.updateCharacter(modal, 'char-1')).resolves.not.toThrow();
  });
});

describe('UIController.updateNPC - error handling', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('dispatches vtt:error when sendStateEvent rejects', async () => {
    const { ui, state } = makeUIForNPCCreate(vi.fn().mockRejectedValue(new Error('forbidden')));
    const npcId = 'npc-1';
    state.npcs.set(npcId, { id: npcId, name: 'Goblin', hp_current: 7, hp_max: 7, actions: [] });
    const modal = makeNPCModal();
    const errors = [];
    window.addEventListener('vtt:error', (e) => errors.push(e.detail), { once: true });

    await ui.updateNPC(modal, npcId);

    expect(errors).toHaveLength(1);
  });

  it('does not throw when sendStateEvent rejects', async () => {
    const { ui, state } = makeUIForNPCCreate(vi.fn().mockRejectedValue(new Error('forbidden')));
    const npcId = 'npc-1';
    state.npcs.set(npcId, { id: npcId, name: 'Goblin', hp_current: 7, hp_max: 7, actions: [] });
    const modal = makeNPCModal();

    await expect(ui.updateNPC(modal, npcId)).resolves.not.toThrow();
  });
});

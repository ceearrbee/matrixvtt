/**
 * Spells.jsx and Skills.jsx both call `ui.state.getCurrentCharacter()`
 * but the only signals they read at the top are `charactersSignal`
 * (collection) and (for Spells) `spellsSignal`. They never read
 * selectedCharacterIdSignal / selectedTokenSignal, so when the user
 * changes character selection (map-click, View Full Sheet from another
 * tab, etc.) while the Spells/Skills tab is open, the panel stays on
 * the old character.
 *
 * Same shape as the View Full Sheet bug - different surface.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { Spells } from '../ui/Spells.jsx';
import { Skills } from '../ui/Skills.jsx';
import {
  selectedCharacterIdSignal, selectedTokenSignal,
} from '../state/ui-signals.js';
import {
  charactersSignal, spellsSignal, settingsSignal,
} from '../state/signals.js';

async function flush() { await Promise.resolve(); await Promise.resolve(); }

function mount(vnode) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(vnode, root);
  return root;
}

/** @type {Record<string, any>} */
const sora = {
  id: 'chr-sora', name: 'Sora', type: 'pc', level: 5,
  attributes: { int: 18 },
  spell_ids: ['sp-mm'],
  skill_proficiencies: ['arcana'],
  skills: { arcana: 7 },
};
/** @type {Record<string, any>} */
const aria = {
  id: 'chr-aria', name: 'Aria', type: 'pc', level: 5,
  attributes: { dex: 18 },
  spell_ids: [],
  skill_proficiencies: ['stealth'],
  skills: { stealth: 8 },
};

function makeUi() {
  return {
    state: {
      get selectedCharacterId() { return selectedCharacterIdSignal.value; },
      set selectedCharacterId(v) { selectedCharacterIdSignal.value = v; },
      get selectedToken() { return selectedTokenSignal.value; },
      set selectedToken(v) { selectedTokenSignal.value = v; },
      characters: new Map([['chr-sora', sora], ['chr-aria', aria]]),
      spells: new Map([['sp-mm', { id: 'sp-mm', name: 'Magic Missile', level: 1 }]]),
      tokens: new Map(),
      settings: { systemConfig: {
        attributes: [{ key: 'int', label: 'INT' }, { key: 'dex', label: 'DEX' }],
        skills: [{ key: 'arcana', label: 'Arcana', attribute: 'int' }, { key: 'stealth', label: 'Stealth', attribute: 'dex' }],
        spell_schools: ['Evocation'],
      }},
      isGM: () => true,
      canEditEntity: () => true,
      getCurrentCharacter() {
        const id = this.selectedCharacterId;
        return id ? this.characters.get(id) : null;
      },
      getCurrentSpells() {
        const ch = this.getCurrentCharacter();
        return (ch?.spell_ids ?? []).map((id) => this.spells.get(id)).filter(Boolean);
      },
    },
    _calcModifier: (s) => Math.floor((Number(s) - 10) / 2),
    rollSkillCheck: vi.fn(),
    showSpellPreview: vi.fn(),
    cycleSkillProficiency: vi.fn(),
    showAddSkillOverrideForm: vi.fn(),
  };
}

beforeEach(() => {
  selectedCharacterIdSignal.value = null;
  selectedTokenSignal.value = null;
  document.body.innerHTML = '';
  charactersSignal.value = new Map();
  spellsSignal.value = new Map();
  settingsSignal.value = { systemConfig: {} };
});

describe('Spells tab follows selection changes', () => {
  it('shows Sora\'s spells when Sora is selected', () => {
    const ui = makeUi();
    charactersSignal.value = ui.state.characters;
    spellsSignal.value = ui.state.spells;
    settingsSignal.value = ui.state.settings;
    selectedCharacterIdSignal.value = 'chr-sora';
    const root = mount(h(Spells, { ui }));
    expect(root.textContent).toMatch(/Magic Missile/);
  });

  it('rerenders when selectedCharacterIdSignal changes Sora → Aria', async () => {
    const ui = makeUi();
    charactersSignal.value = ui.state.characters;
    spellsSignal.value = ui.state.spells;
    settingsSignal.value = ui.state.settings;
    selectedCharacterIdSignal.value = 'chr-sora';
    const root = mount(h(Spells, { ui }));
    expect(root.textContent).toMatch(/Magic Missile/);

    // Switch to Aria (no spells). Component must re-render even though
    // charactersSignal / spellsSignal collections didn't change.
    selectedCharacterIdSignal.value = 'chr-aria';
    await flush();
    expect(root.textContent).not.toMatch(/Magic Missile/);
  });
});

describe('Skills tab follows selection changes', () => {
  it('shows Sora\'s skills when Sora is selected', () => {
    const ui = makeUi();
    charactersSignal.value = ui.state.characters;
    settingsSignal.value = ui.state.settings;
    selectedCharacterIdSignal.value = 'chr-sora';
    const root = mount(h(Skills, { ui }));
    // Arcana is one of the ruleset skills; with Sora's override of 7 it shows
    expect(root.textContent).toMatch(/Arcana/);
  });

  it('rerenders when selection changes - Stealth bonus reflects Aria not Sora', async () => {
    const ui = makeUi();
    charactersSignal.value = ui.state.characters;
    settingsSignal.value = ui.state.settings;
    selectedCharacterIdSignal.value = 'chr-sora';
    const root = mount(h(Skills, { ui }));
    // Sora has no Stealth proficiency / bonus override → DEX modifier only

    selectedCharacterIdSignal.value = 'chr-aria';
    await flush();
    // Aria's Stealth override is 8 → row must show +8
    expect(root.textContent).toMatch(/\+8/);
  });
});

import { describe, it, expect } from 'vitest';
import {
  crToString,
  costToGp,
  sensesToString,
  transformSpell,
  transformMonster,
  transformEquipment,
  transformMagicItem,
} from '../../scripts/srd5e-transform.mjs';
import { validateSpell, validateItem } from '../utils/schemas/content.js';
import { validateCharacter } from '../utils/schemas/actors.js';
import dnd5e from '../content/rulesets/dnd5e.json' with { type: 'json' };

const RAW_SPELL = {
  index: 'fire-bolt',
  name: 'Fire Bolt',
  desc: ['You hurl a mote of fire at a creature or object within range.'],
  higher_level: ['This spell’s damage increases by 1d10 when you reach 5th level.'],
  range: '120 feet',
  components: ['V', 'S'],
  ritual: false,
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '1 action',
  level: 0,
  attack_type: 'ranged',
  damage: {
    damage_type: { index: 'fire', name: 'Fire' },
    damage_at_character_level: { 1: '1d10', 5: '2d10' },
  },
  school: { index: 'evocation', name: 'Evocation' },
  classes: [{ index: 'sorcerer', name: 'Sorcerer' }, { index: 'wizard', name: 'Wizard' }],
};

const RAW_SAVE_SPELL = {
  index: 'fireball',
  name: 'Fireball',
  desc: ['A bright streak flashes.', 'Each creature must make a Dexterity saving throw.'],
  range: '150 feet',
  components: ['V', 'S', 'M'],
  material: 'A tiny ball of bat guano and sulfur.',
  ritual: false,
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '1 action',
  level: 3,
  dc: { dc_type: { index: 'dex', name: 'DEX' }, dc_success: 'half' },
  damage: {
    damage_type: { index: 'fire', name: 'Fire' },
    damage_at_slot_level: { 3: '8d6', 4: '9d6' },
  },
  school: { index: 'evocation', name: 'Evocation' },
  classes: [{ index: 'sorcerer', name: 'Sorcerer' }],
};

const RAW_MONSTER = {
  index: 'goblin',
  name: 'Goblin',
  size: 'Small',
  type: 'humanoid',
  subtype: 'goblinoid',
  alignment: 'neutral evil',
  armor_class: [{ type: 'armor', value: 15 }],
  hit_points: 7,
  hit_dice: '2d6',
  speed: { walk: '30 ft.' },
  strength: 8,
  dexterity: 14,
  constitution: 10,
  intelligence: 10,
  wisdom: 8,
  charisma: 8,
  proficiencies: [
    { value: 6, proficiency: { index: 'skill-stealth', name: 'Skill: Stealth' } },
  ],
  damage_vulnerabilities: [],
  damage_resistances: [],
  damage_immunities: [],
  condition_immunities: [],
  senses: { darkvision: '60 ft.', passive_perception: 9 },
  languages: 'Common, Goblin',
  challenge_rating: 0.25,
  proficiency_bonus: 2,
  xp: 50,
  special_abilities: [
    { name: 'Nimble Escape', desc: 'The goblin can take the Disengage or Hide action as a bonus action.' },
  ],
  actions: [
    {
      name: 'Scimitar',
      desc: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
      attack_bonus: 4,
      damage: [{ damage_type: { index: 'slashing', name: 'Slashing' }, damage_dice: '1d6+2' }],
    },
  ],
};

const RAW_EQUIPMENT = {
  index: 'club',
  name: 'Club',
  equipment_category: { index: 'weapon', name: 'Weapon' },
  weapon_category: 'Simple',
  weapon_range: 'Melee',
  category_range: 'Simple Melee',
  cost: { quantity: 1, unit: 'sp' },
  damage: { damage_dice: '1d4', damage_type: { index: 'bludgeoning', name: 'Bludgeoning' } },
  range: { normal: 5 },
  weight: 2,
  properties: [
    { index: 'light', name: 'Light' },
    { index: 'monk', name: 'Monk' },
  ],
};

const RAW_ARMOR = {
  index: 'chain-mail',
  name: 'Chain Mail',
  equipment_category: { index: 'armor', name: 'Armor' },
  armor_category: 'Heavy',
  armor_class: { base: 16, dex_bonus: false },
  str_minimum: 13,
  stealth_disadvantage: true,
  cost: { quantity: 75, unit: 'gp' },
  weight: 55,
};

const RAW_MAGIC_ITEM_PARENT = {
  index: 'ammunition',
  name: 'Ammunition, +1, +2, or +3',
  equipment_category: { index: 'ammunition', name: 'Ammunition' },
  rarity: { name: 'Varies' },
  variants: [{ index: 'ammunition-1', name: 'Ammunition, +1' }],
  variant: false,
  desc: ['You have a bonus to attack and damage rolls.'],
};

const RAW_MAGIC_ITEM_CHILD = {
  index: 'ammunition-1',
  name: 'Ammunition, +1',
  equipment_category: { index: 'ammunition', name: 'Ammunition' },
  rarity: { name: 'Uncommon' },
  variants: [],
  variant: true,
  desc: ['You have a +1 bonus to attack and damage rolls made with this piece of magic ammunition.'],
};

describe('crToString', () => {
  it('renders fractional CRs the way stat blocks write them', () => {
    expect(crToString(0.125)).toBe('1/8');
    expect(crToString(0.25)).toBe('1/4');
    expect(crToString(0.5)).toBe('1/2');
  });

  it('renders whole CRs as plain numbers', () => {
    expect(crToString(0)).toBe('0');
    expect(crToString(1)).toBe('1');
    expect(crToString(24)).toBe('24');
  });
});

describe('costToGp', () => {
  it('converts each coin denomination to gp', () => {
    expect(costToGp({ quantity: 1, unit: 'sp' })).toBe(0.1);
    expect(costToGp({ quantity: 50, unit: 'cp' })).toBe(0.5);
    expect(costToGp({ quantity: 75, unit: 'gp' })).toBe(75);
    expect(costToGp({ quantity: 2, unit: 'pp' })).toBe(20);
    expect(costToGp({ quantity: 4, unit: 'ep' })).toBe(2);
  });

  it('returns undefined when no cost is given', () => {
    expect(costToGp(undefined)).toBe(undefined);
  });
});

describe('sensesToString', () => {
  it('joins senses in stat-block wording', () => {
    expect(sensesToString({ darkvision: '60 ft.', passive_perception: 9 })).toBe(
      'Darkvision 60 ft., passive Perception 9'
    );
  });

  it('handles multi-word sense names', () => {
    expect(sensesToString({ blindsight: '30 ft.', truesight: '120 ft.', passive_perception: 14 })).toBe(
      'Blindsight 30 ft., Truesight 120 ft., passive Perception 14'
    );
  });
});

describe('transformSpell', () => {
  it('produces a spell record in the campaign shape', () => {
    const spell = transformSpell(RAW_SPELL);
    expect(spell.id).toBe('srd-sp-fire-bolt');
    expect(spell.name).toBe('Fire Bolt');
    expect(spell.level).toBe(0);
    expect(spell.school).toBe('Evocation');
    expect(spell.casting_time).toBe('1 action');
    expect(spell.range).toBe('120 feet');
    expect(spell.duration).toBe('Instantaneous');
    expect(spell.components).toBe('V, S');
    expect(spell.concentration).toBe(false);
    expect(spell.ritual).toBe(false);
    expect(spell.damage).toBe('1d10');
    expect(spell.damage_type).toBe('fire');
    expect(spell.description).toContain('mote of fire');
    expect(spell.higher_level).toContain('5th level');
    expect(spell.classes).toEqual(['Sorcerer', 'Wizard']);
    expect(spell.source).toBe('SRD 5.1');
    expect(validateSpell(spell)).toBe(true);
  });

  it('uses the base slot level for damage and records the save ability', () => {
    const spell = transformSpell(RAW_SAVE_SPELL);
    expect(spell.damage).toBe('8d6');
    expect(spell.save_ability).toBe('DEX');
    expect(spell.material).toBe('A tiny ball of bat guano and sulfur.');
    expect(spell.components).toBe('V, S, M');
  });
});

describe('transformMonster', () => {
  it('produces an NPC record that passes character validation', () => {
    const npc = transformMonster(RAW_MONSTER);
    expect(npc.id).toBe('srd-npc-goblin');
    expect(npc.type).toBe('npc');
    expect(npc.name).toBe('Goblin');
    expect(npc.cr).toBe('1/4');
    expect(npc.xp).toBe(50);
    expect(npc.size_category).toBe('Small');
    expect(npc.creature_type).toBe('Humanoid (goblinoid)');
    expect(npc.alignment).toBe('neutral evil');
    expect(npc.ac).toBe(15);
    expect(npc.hp_max).toBe(7);
    expect(npc.hp_current).toBe(7);
    expect(npc.hit_dice).toBe('2d6');
    expect(npc.speed).toBe(30);
    expect(npc.attributes).toEqual({ str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 });
    expect(npc.senses).toBe('Darkvision 60 ft., passive Perception 9');
    expect(npc.languages).toBe('Common, Goblin');
    expect(npc.skills).toBe('Stealth +6');
    expect(npc.traits).toEqual([
      { name: 'Nimble Escape', description: 'The goblin can take the Disengage or Hide action as a bonus action.' },
    ]);
    expect(npc.actions).toEqual([
      {
        name: 'Scimitar',
        description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
        attack_bonus: 4,
        damage: '1d6+2',
        damage_type: 'slashing',
      },
    ]);
    expect(npc.source).toBe('SRD 5.1');
    expect(validateCharacter(npc, dnd5e)).toBe(true);
  });

  it('splits saving throw proficiencies from skills', () => {
    const npc = transformMonster({
      ...RAW_MONSTER,
      proficiencies: [
        { value: 6, proficiency: { index: 'saving-throw-con', name: 'Saving Throw: CON' } },
        { value: 5, proficiency: { index: 'skill-perception', name: 'Skill: Perception' } },
      ],
    });
    expect(npc.saving_throws).toBe('CON +6');
    expect(npc.skills).toBe('Perception +5');
  });
});

describe('transformEquipment', () => {
  it('produces an item record in the campaign shape', () => {
    const item = transformEquipment(RAW_EQUIPMENT);
    expect(item.id).toBe('srd-itm-club');
    expect(item.name).toBe('Club');
    expect(item.type).toBe('Weapon');
    expect(item.rarity).toBe('common');
    expect(item.cost_gp).toBe(0.1);
    expect(item.weight).toBe(2);
    expect(item.damage).toBe('1d4');
    expect(item.damage_type).toBe('bludgeoning');
    expect(item.properties).toBe('light, monk');
    expect(item.source).toBe('SRD 5.1');
    expect(validateItem(item)).toBe(true);
  });

  it('describes armor stats in text', () => {
    const item = transformEquipment(RAW_ARMOR);
    expect(item.ac_text).toBe('AC 16');
    expect(item.description).toContain('Requires Str 13');
    expect(item.description).toContain('Disadvantage on Stealth');
    const breastplate = transformEquipment({
      ...RAW_ARMOR,
      index: 'breastplate',
      name: 'Breastplate',
      armor_class: { base: 14, dex_bonus: true, max_bonus: 2 },
      str_minimum: 0,
      stealth_disadvantage: false,
    });
    expect(breastplate.ac_text).toBe('AC 14 + Dex (max 2)');
  });
});

describe('transformMagicItem', () => {
  it('skips variant parents and keeps concrete variants', () => {
    expect(transformMagicItem(RAW_MAGIC_ITEM_PARENT)).toBe(null);
    const item = transformMagicItem(RAW_MAGIC_ITEM_CHILD);
    expect(item.id).toBe('srd-mi-ammunition-1');
    expect(item.rarity).toBe('uncommon');
    expect(item.type).toBe('Ammunition');
    expect(item.description).toContain('+1 bonus');
    expect(item.source).toBe('SRD 5.1');
    expect(validateItem(item)).toBe(true);
  });
});

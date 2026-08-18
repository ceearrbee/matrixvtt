/**
 * Pure mapping functions from the 5e-bits/5e-database SRD 5.1 record
 * shapes to MatrixVTT campaign entity shapes (see
 * src/utils/schemas/content.js and actors.js). Used by
 * scripts/build-5e-srd.mjs at dev time; never shipped in the bundle.
 */

const SOURCE = 'SRD 5.1';

const FRACTIONAL_CR = new Map([
  [0.125, '1/8'],
  [0.25, '1/4'],
  [0.5, '1/2'],
]);

export function crToString(cr) {
  return FRACTIONAL_CR.get(cr) ?? String(cr);
}

const GP_PER_UNIT = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

export function costToGp(cost) {
  if (!cost) return undefined;
  const rate = GP_PER_UNIT[cost.unit];
  if (rate === undefined) return undefined;
  return Math.round(cost.quantity * rate * 100) / 100;
}

export function sensesToString(senses) {
  if (!senses) return '';
  return Object.entries(senses)
    .map(([key, value]) =>
      key === 'passive_perception'
        ? `passive Perception ${value}`
        : `${key.charAt(0).toUpperCase()}${key.slice(1)} ${value}`
    )
    .join(', ');
}

function joinParagraphs(lines) {
  return Array.isArray(lines) ? lines.join('\n\n') : '';
}

export function transformSpell(raw) {
  const damageAtBase =
    raw.damage?.damage_at_slot_level?.[raw.level] ??
    raw.damage?.damage_at_character_level?.[1];
  const spell = {
    id: `srd-sp-${raw.index}`,
    name: raw.name,
    level: raw.level,
    school: raw.school?.name ?? '',
    casting_time: raw.casting_time,
    range: raw.range,
    duration: raw.duration,
    components: (raw.components ?? []).join(', '),
    concentration: Boolean(raw.concentration),
    ritual: Boolean(raw.ritual),
    description: joinParagraphs(raw.desc),
    classes: (raw.classes ?? []).map((c) => c.name),
    source: SOURCE,
  };
  if (raw.higher_level?.length) spell.higher_level = joinParagraphs(raw.higher_level);
  if (raw.material) spell.material = raw.material;
  if (damageAtBase) spell.damage = damageAtBase;
  if (raw.damage?.damage_type) spell.damage_type = raw.damage.damage_type.name.toLowerCase();
  if (raw.dc) spell.save_ability = raw.dc.dc_type.name;
  return spell;
}

function proficiencyList(raw, prefix) {
  const found = (raw.proficiencies ?? [])
    .filter((p) => p.proficiency.name.startsWith(prefix))
    .map((p) => {
      const name = p.proficiency.name.slice(prefix.length);
      const sign = p.value >= 0 ? '+' : '';
      return `${name} ${sign}${p.value}`;
    });
  return found.length ? found.join(', ') : undefined;
}

function actionEntry(raw) {
  const entry = { name: raw.name, description: raw.desc };
  if (raw.attack_bonus !== undefined) entry.attack_bonus = raw.attack_bonus;
  const damage = raw.damage?.find((d) => d.damage_dice);
  if (damage) {
    entry.damage = damage.damage_dice;
    if (damage.damage_type) entry.damage_type = damage.damage_type.name.toLowerCase();
  }
  return entry;
}

function traitEntry(raw) {
  return { name: raw.name, description: raw.desc };
}

export function transformMonster(raw) {
  const npc = {
    id: `srd-npc-${raw.index}`,
    type: 'npc',
    name: raw.name,
    cr: crToString(raw.challenge_rating),
    xp: raw.xp,
    size_category: raw.size,
    creature_type: raw.subtype ? `${capitalize(raw.type)} (${raw.subtype})` : capitalize(raw.type),
    alignment: raw.alignment,
    ac: raw.armor_class?.[0]?.value ?? 10,
    hp_max: raw.hit_points,
    hp_current: raw.hit_points,
    hit_dice: raw.hit_dice,
    speed: parseInt(raw.speed?.walk ?? '0', 10) || 0,
    attributes: {
      str: raw.strength,
      dex: raw.dexterity,
      con: raw.constitution,
      int: raw.intelligence,
      wis: raw.wisdom,
      cha: raw.charisma,
    },
    senses: sensesToString(raw.senses),
    languages: raw.languages ?? '',
    is_hidden: false,
    source: SOURCE,
  };

  const speedModes = Object.entries(raw.speed ?? {});
  if (speedModes.length > 1 || !raw.speed?.walk) {
    npc.speed_detail = speedModes.map(([mode, value]) => `${mode} ${value}`).join(', ');
  }

  const savingThrows = proficiencyList(raw, 'Saving Throw: ');
  if (savingThrows) npc.saving_throws = savingThrows;
  const skills = proficiencyList(raw, 'Skill: ');
  if (skills) npc.skills = skills;

  for (const [rawKey, key] of [
    ['damage_vulnerabilities', 'damage_vulnerabilities'],
    ['damage_resistances', 'damage_resistances'],
    ['damage_immunities', 'damage_immunities'],
  ]) {
    if (raw[rawKey]?.length) npc[key] = raw[rawKey].join(', ');
  }
  if (raw.condition_immunities?.length) {
    npc.condition_immunities = raw.condition_immunities.map((c) => c.name).join(', ');
  }

  if (raw.special_abilities?.length) npc.traits = raw.special_abilities.map(traitEntry);
  if (raw.actions?.length) npc.actions = raw.actions.map(actionEntry);
  if (raw.reactions?.length) npc.reactions = raw.reactions.map(actionEntry);
  if (raw.legendary_actions?.length) npc.legendary_actions = raw.legendary_actions.map(actionEntry);
  if (raw.desc) npc.notes = Array.isArray(raw.desc) ? joinParagraphs(raw.desc) : raw.desc;

  return npc;
}

function capitalize(text) {
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

function armorClassText(armorClass) {
  if (!armorClass) return undefined;
  let text = `AC ${armorClass.base}`;
  if (armorClass.dex_bonus) {
    text += armorClass.max_bonus ? ` + Dex (max ${armorClass.max_bonus})` : ' + Dex';
  }
  return text;
}

export function transformEquipment(raw) {
  const descriptionParts = [];
  if (raw.desc?.length) descriptionParts.push(joinParagraphs(raw.desc));
  if (raw.special?.length) descriptionParts.push(joinParagraphs(raw.special));
  if (raw.str_minimum) descriptionParts.push(`Requires Str ${raw.str_minimum}.`);
  if (raw.stealth_disadvantage) descriptionParts.push('Disadvantage on Stealth checks.');
  if (raw.contents?.length) {
    const contents = raw.contents.map((c) => `${c.quantity}x ${c.item.name}`).join(', ');
    descriptionParts.push(`Contents: ${contents}.`);
  }

  const item = {
    id: `srd-itm-${raw.index}`,
    name: raw.name,
    type: raw.equipment_category?.name ?? '',
    rarity: 'common',
    quantity: 1,
    description: descriptionParts.join('\n\n'),
    source: SOURCE,
  };
  const costGp = costToGp(raw.cost);
  if (costGp !== undefined) item.cost_gp = costGp;
  if (raw.weight !== undefined) item.weight = raw.weight;
  if (raw.damage) {
    item.damage = raw.damage.damage_dice;
    item.damage_type = raw.damage.damage_type.name.toLowerCase();
  }
  if (raw.properties?.length) {
    item.properties = raw.properties.map((p) => p.name.toLowerCase()).join(', ');
  }
  if (raw.category_range) item.category = raw.category_range;
  if (raw.range?.long) item.range_text = `${raw.range.normal}/${raw.range.long} ft.`;
  const acText = armorClassText(raw.armor_class);
  if (acText) item.ac_text = acText;
  return item;
}

export function transformMagicItem(raw) {
  if (raw.variants?.length) return null;
  return {
    id: `srd-mi-${raw.index}`,
    name: raw.name,
    type: raw.equipment_category?.name ?? '',
    rarity: (raw.rarity?.name ?? 'common').toLowerCase(),
    quantity: 1,
    description: joinParagraphs(raw.desc),
    source: SOURCE,
  };
}

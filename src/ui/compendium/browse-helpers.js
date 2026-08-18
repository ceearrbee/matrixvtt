/**
 * Pure logic for the SRD compendium browser: name filtering, result
 * capping, id-collision suffixing, secondary-filter option lists, and
 * per-kind row summaries. Kept DOM-free so tests exercise it directly.
 */

export function capResults(entries, cap) {
  if (entries.length <= cap) return { shown: entries, hiddenCount: 0 };
  return { shown: entries.slice(0, cap), hiddenCount: entries.length - cap };
}

/**
 * Compendium ids are stable (`srd-sp-fireball`), so adding the same
 * entry twice must suffix rather than overwrite the campaign copy.
 */
export function resolveEntryId(baseId, collection) {
  if (!collection.has(baseId)) return baseId;
  let n = 2;
  while (collection.has(`${baseId}-${n}`)) n += 1;
  return `${baseId}-${n}`;
}

export function crToNumber(cr) {
  if (typeof cr === 'string' && cr.includes('/')) {
    const [num, den] = cr.split('/');
    return Number(num) / Number(den);
  }
  return Number(cr);
}

export function distinctSpellLevels(spells) {
  return [...new Set(spells.map((s) => s.level))].sort((a, b) => a - b);
}

export function distinctMonsterCRs(monsters) {
  return [...new Set(monsters.map((m) => m.cr))].sort((a, b) => crToNumber(a) - crToNumber(b));
}

export function distinctItemTypes(items) {
  return [...new Set(items.map((i) => i.type).filter(Boolean))].sort();
}

function joinParts(left, right) {
  return [left, right].filter(Boolean).join(' · ');
}

export function spellSummary(spell) {
  const level = spell.level === undefined
    ? ''
    : spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;
  return joinParts(level, spell.school);
}

export function monsterSummary(monster) {
  return joinParts(monster.cr ? `CR ${monster.cr}` : '', monster.creature_type);
}

export function itemSummary(item) {
  return joinParts(item.type, item.rarity);
}

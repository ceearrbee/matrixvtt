export function characterToMarkdown(ui, char, id) {
  let md = `## ${char.name}\n\n`;
  md += `*ID: \`${id}\`*\n\n`;
  md += `**${char.class_level}** · **${char.species}**\n\n`;

  md += `### Stats\n\n`;
  md += `- **HP:** ${char.hp_current}/${char.hp_max}\n`;
  md += `- **AC:** ${char.ac}\n`;
  md += `- **Speed:** ${char.speed}\n`;
  md += `- **Initiative:** +${char.initiative_bonus}\n\n`;

  md += `### Attributes\n\n`;
  const charAttrs = ui._getSystemAttrs();
  md += `| ${charAttrs.map((a) => a.label).join(' | ')} |\n`;
  md += `| ${charAttrs.map(() => '---').join(' | ')} |\n`;
  md += `| ${charAttrs.map((a) => char.attributes[a.key] ?? a.default ?? 10).join(' | ')} |\n\n`;

  if (Object.keys(char.skills).length > 0) {
    md += `### Skills\n\n`;
    for (const [skill, bonus] of Object.entries(char.skills)) {
      md += `- **${skill.replace('_', ' ')}:** +${bonus}\n`;
    }
    md += `\n`;
  }

  if (char.saving_throws && Object.keys(char.saving_throws).length > 0) {
    md += `### Saving Throws\n\n`;
    for (const [key, bonus] of Object.entries(char.saving_throws)) {
      md += `- **${key}:** ${bonus >= 0 ? '+' : ''}${bonus}\n`;
    }
    md += `\n`;
  }

  if (char.spell_slots && Object.keys(char.spell_slots).length > 0) {
    md += `### Spell Slots\n\n`;
    for (const [level, slot] of Object.entries(char.spell_slots)
      .sort(([a], [b]) => Number(a) - Number(b))) {
      md += `- **Level ${level}:** ${slot.used ?? 0}/${slot.total ?? 0}\n`;
    }
    md += `\n`;
  }

  if (Array.isArray(char.inventory_ids) && char.inventory_ids.length > 0) {
    md += `### Inventory\n\n`;
    for (const itemId of char.inventory_ids) {
      const item = ui.state?.items?.get?.(itemId);
      if (!item) continue;
      md += `#### ${item.name}\n\n`;
      const meta = [];
      if (item.quantity !== undefined && item.quantity !== null) meta.push(`qty: ${item.quantity}`);
      if (item.weight !== undefined && item.weight !== null) meta.push(`weight: ${item.weight}`);
      if (item.equipped === true) meta.push('equipped');
      if (meta.length) md += `*${meta.join(' · ')}*\n\n`;
      if (item.damage) md += `- **Damage:** ${item.damage}${item.damage_type ? ` ${item.damage_type}` : ''}\n`;
      if (item.properties) md += `- **Properties:** ${item.properties}\n`;
      if (item.description) md += `\n${item.description}\n`;
      md += `\n`;
    }
  }

  if (char.notes) md += `### Notes\n\n${char.notes}\n\n`;
  return md;
}

export function npcToMarkdown(ui, npc, id) {
  let md = `## ${npc.name}\n\n`;
  md += `*ID: \`${id}\`*\n\n`;
  md += `**CR ${npc.cr}** · **${npc.size_category}**\n\n`;

  md += `### Stats\n\n`;
  md += `- **HP:** ${npc.hp_current}/${npc.hp_max}\n`;
  md += `- **AC:** ${npc.ac}\n`;
  md += `- **Speed:** ${npc.speed}\n\n`;

  md += `### Attributes\n\n`;
  const npcAttrs = ui._getSystemAttrs();
  md += `| ${npcAttrs.map((a) => a.label).join(' | ')} |\n`;
  md += `| ${npcAttrs.map(() => '---').join(' | ')} |\n`;
  md += `| ${npcAttrs.map((a) => npc.attributes[a.key] ?? a.default ?? 10).join(' | ')} |\n\n`;

  const sections = [
    ['Actions', npc.actions],
    ['Legendary Actions', npc.legendary_actions],
    ['Lair Actions', npc.lair_actions],
    ['Reactions', npc.reactions],
    ['Traits', npc.traits],
  ];
  for (const [heading, list] of sections) {
    if (!Array.isArray(list) || list.length === 0) continue;
    md += `### ${heading}\n\n`;
    for (const action of list) {
      md += `#### ${action.name}\n\n`;
      if (action.attack_bonus) {
        md += `*+${action.attack_bonus} to hit*`;
        if (action.damage) md += ` · *${action.damage} ${action.damage_type || ''}*`;
        md += `\n\n`;
      }
      if (action.description) md += `${action.description}\n\n`;
    }
  }
  return md;
}

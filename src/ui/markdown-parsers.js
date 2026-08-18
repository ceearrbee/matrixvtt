/**
 * markdown-parsers.js - Parse markdown-formatted character/NPC sections into state objects.
 *
 * All functions receive the UIController instance as `ui`.
 */

import { ENTITY_TYPES } from '../utils/constants.js';

/** Import a character from markdown section */
export async function importCharacterFromMarkdown(ui, section) {
  const nameMatch = section.match(/^##\s+(.+)$/m);
  if (!nameMatch) return;

  const charId = `chr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { class_level, species } = _extractPCMeta(section);
  const stats = _extractPCStats(section);
  const attributes = parseAttributeTable(ui, section);
  const skills = _extractPCSkills(section);
  const saving_throws = _extractPCSaves(section);
  const spell_slots = _extractPCSpellSlots(section);
  const notes = _extractPCNotes(section);
  const inventory_ids = await _extractInventoryIds(ui, section);

  const character = {
    id: charId, type: ENTITY_TYPES.PC, name: nameMatch[1].trim(),
    player_user_id: ui.widgetManager.userId, token_id: null,
    species, class_level, ...stats, attributes, skills,
    saving_throws, spell_slots, conditions: [], inventory_ids, notes
  };

  await ui.state.updateCharacter(charId, character);
}

async function _extractInventoryIds(ui, section) {
  const s = section.match(/### Inventory\n\n([\s\S]*?)(?=\n###|\n\n---|\n$)/);
  if (!s) return [];
  const blocks = s[1].split(/^####\s+/m).filter((b) => b.trim());
  const resolved = [];
  for (const block of blocks) {
    const item = _parseInventoryBlock(block);
    if (!item) continue;
    const id = await _resolveOrCreateItem(ui, item);
    if (id) resolved.push(id);
  }
  return resolved;
}

function _parseInventoryBlock(block) {
  const nameMatch = block.match(/^(.+?)\n/);
  if (!nameMatch) return null;
  const name = nameMatch[1].trim();
  if (!name) return null;
  const meta = block.match(/\*([^*]+)\*\n/);
  let quantity, weight, equipped;
  if (meta) {
    const qty = meta[1].match(/qty:\s*(\d+)/);
    const wt = meta[1].match(/weight:\s*([\d.]+)/);
    quantity = qty ? Number(qty[1]) : undefined;
    weight = wt ? Number(wt[1]) : undefined;
    equipped = /equipped/i.test(meta[1]) || undefined;
  }
  const dmgLine = block.match(/\*\*Damage:\*\*\s*([^\n]+)/);
  let damage, damage_type;
  if (dmgLine) {
    const tokens = dmgLine[1].trim().split(/\s+/);
    damage = tokens[0];
    damage_type = tokens.length > 1 ? tokens.slice(1).join(' ') : undefined;
  }
  const props = block.match(/\*\*Properties:\*\*\s*([^\n]+)/);
  // Description is anything after the last bullet/meta block - split off
  // the trailing free-text paragraph if it exists.
  const lines = block.split('\n');
  const descLines = [];
  let inDesc = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!inDesc) {
      if (line.trim() === '' || line.startsWith('*') || line.startsWith('-') || line.startsWith('#')) continue;
      inDesc = true;
    }
    descLines.push(line);
  }
  const description = descLines.join('\n').trim() || undefined;
  return { name, quantity, weight, equipped, damage, damage_type, properties: props ? props[1].trim() : undefined, description };
}

function _itemHash(item) {
  return [
    String(item.name || '').toLowerCase().trim(),
    String(item.damage || ''),
    String(item.weight ?? ''),
  ].join('|');
}

async function _resolveOrCreateItem(ui, parsed) {
  const items = ui.state?.items;
  if (items && typeof items.values === 'function') {
    const target = _itemHash(parsed);
    for (const existing of items.values()) {
      if (_itemHash(existing) === target) return existing.id;
    }
  }
  const id = `itm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const item = { id, ...parsed };
  // Strip undefined fields so the schema validator doesn't trip on them.
  for (const k of Object.keys(item)) if (item[k] === undefined) delete item[k];
  await ui.state.updateItem?.(id, item);
  return id;
}

function _extractPCMeta(section) {
  const match = section.match(/\*\*(.+?)\*\*\s*·\s*\*\*(.+?)\*\*/);
  return { class_level: match?.[1] ?? '', species: match?.[2] ?? '' };
}

function _extractPCStats(section) {
  const hp = section.match(/HP:\*\*\s*(\d+)\/(\d+)/);
  const ac = section.match(/AC:\*\*\s*(\d+)/);
  const speed = section.match(/Speed:\*\*\s*(\d+)/);
  const init = section.match(/Initiative:\*\*\s*\+?(-?\d+)/);
  return {
    hp_max: hp ? parseInt(hp[2]) : 30,
    hp_current: hp ? parseInt(hp[1]) : 30,
    ac: ac ? parseInt(ac[1]) : 10,
    speed: speed ? parseInt(speed[1]) : 30,
    initiative_bonus: init ? parseInt(init[1]) : 0
  };
}

function _extractPCSkills(section) {
  const skills = {};
  const s = section.match(/### Skills\n\n([\s\S]*?)(?=\n###|\n\n---|\n$)/);
  if (s) {
    const lines = s[1].match(/- \*\*(.+?):\*\* \+(\d+)/g) || [];
    lines.forEach(line => {
      const m = line.match(/\*\*(.+?):\*\* \+(\d+)/);
      if (m) skills[m[1].toLowerCase().replace(/\s+/g, '_')] = parseInt(m[2]);
    });
  }
  return skills;
}

function _extractPCSaves(section) {
  const saves = {};
  const s = section.match(/### Saving Throws\n\n([\s\S]*?)(?=\n###|\n\n---|\n$)/);
  if (s) {
    const lines = s[1].match(/- \*\*(.+?):\*\*\s*([+-]?\d+)/g) || [];
    lines.forEach(line => {
      const m = line.match(/\*\*(.+?):\*\*\s*([+-]?\d+)/);
      if (m) saves[m[1].toLowerCase().replace(/\s+/g, '_')] = parseInt(m[2]);
    });
  }
  return saves;
}

function _extractPCSpellSlots(section) {
  const slots = {};
  const s = section.match(/### Spell Slots\n\n([\s\S]*?)(?=\n###|\n\n---|\n$)/);
  if (s) {
    const lines = s[1].match(/- \*\*Level\s+(\d+):\*\*\s*(\d+)\/(\d+)/g) || [];
    lines.forEach(line => {
      const m = line.match(/Level\s+(\d+):\*\*\s*(\d+)\/(\d+)/);
      if (m) slots[m[1]] = { used: parseInt(m[2]), total: parseInt(m[3]) };
    });
  }
  return slots;
}

function _extractPCNotes(section) {
  const match = section.match(/### Notes\n\n([\s\S]*?)(?=\n###|\n\n---|\n$)/);
  return match ? match[1].trim() : '';
}

/** Import an NPC from markdown section */
export async function importNPCFromMarkdown(ui, section) {
  const nameMatch = section.match(/^##\s+(.+)$/m);
  if (!nameMatch) return;

  const npcId = `npc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { cr, size_category } = _extractNPCMeta(section);
  const stats = _extractNPCStats(section);
  const attributes = parseAttributeTable(ui, section);
  const actions = _extractNPCActionList(section, 'Actions');
  const legendary_actions = _extractNPCActionList(section, 'Legendary Actions');
  const lair_actions = _extractNPCActionList(section, 'Lair Actions');
  const reactions = _extractNPCActionList(section, 'Reactions');
  const traits = _extractNPCActionList(section, 'Traits');

  const npc = {
    id: npcId, type: ENTITY_TYPES.NPC, name: nameMatch[1].trim(),
    cr, size_category, ...stats, attributes, actions,
    legendary_actions, lair_actions, reactions, traits,
    is_hidden: false, notes: ''
  };

  await ui.state.updateNPC(npcId, npc);
}

function _extractNPCMeta(section) {
  const match = section.match(/\*\*CR\s+(.+?)\*\*\s*·\s*\*\*(.+?)\*\*/);
  return { cr: match?.[1] ?? '1', size_category: match?.[2] ?? 'Medium' };
}

function _extractNPCStats(section) {
  const hp = section.match(/HP:\*\*\s*(\d+)\/(\d+)/);
  const ac = section.match(/AC:\*\*\s*(\d+)/);
  const speed = section.match(/Speed:\*\*\s*(\d+)/);
  return {
    hp_max: hp ? parseInt(hp[2]) : 20,
    hp_current: hp ? parseInt(hp[1]) : 20,
    ac: ac ? parseInt(ac[1]) : 10,
    speed: speed ? parseInt(speed[1]) : 30
  };
}

function _extractNPCActionList(section, heading) {
  const actions = [];
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // eslint-disable-next-line security/detect-non-literal-regexp -- `escaped` is regex-escaped via the line above
  const re = new RegExp(`### ${escaped}\\n\\n([\\s\\S]*?)(?=\\n###|\\n\\n---|\\n$)`);
  const s = section.match(re);
  if (s) {
    s[1].split(/####\s+/).forEach(block => {
      if (!block.trim()) return;
      const nameMatch = block.match(/^(.+?)\n/);
      if (nameMatch) {
        actions.push({
          name: nameMatch[1].trim(),
          description: (block.match(/\n\n(.+?)$/s)?.[1] ?? '').trim(),
          attack_bonus: parseInt(block.match(/\*\+(\d+)\s+to\s+hit\*/)?.[1]) || null,
          damage: block.match(/\*([0-9d+-]+)\s+(\w+)\*/)?.[1] || null,
          damage_type: block.match(/\*([0-9d+-]+)\s+(\w+)\*/)?.[2] || null
        });
      }
    });
  }
  return actions;
}

function parseAttributeTable(ui, section) {
  const attrs = ui._getSystemAttrs();
  const defaults = {};
  attrs.forEach(a => { defaults[a.key] = a.default ?? 10; });

  const attrSection = section.match(/### Attributes\n\n([\s\S]*?)(?=\n###|$)/);
  if (!attrSection) return defaults;

  const rows = attrSection[1].split('\n').filter(r => r.trim().startsWith('|'));
  if (rows.length < 3) return defaults;

  const headers = rows[0].split('|').map(h => h.trim()).filter(Boolean);
  const dataRow = rows[2].split('|').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
  if (dataRow.length !== headers.length) return defaults;

  const labelToKey = {};
  attrs.forEach(a => { labelToKey[a.label.toUpperCase()] = a.key; });

  const result = { ...defaults };
  headers.forEach((header, i) => {
    const key = labelToKey[header.toUpperCase()];
    if (key !== undefined) result[key] = dataRow[i];
  });
  return result;
}

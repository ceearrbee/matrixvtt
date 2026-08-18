/**
 * play-actions/sources.js - pure resolvers that turn a (character,
 * state, ruleset) tuple into a list of "things this character can do
 * right now." Each group config in a `play_actions` section names one
 * of these sources; the section component calls `resolveGroup` and
 * renders the result as a list of buttons.
 *
 * Keep these functions pure (no DOM, no `ui` parameter, no side
 * effects) so they're testable without rigging up a render context.
 */

/**
 * Pull `character.actions[]` with optional shape filtering.
 *
 * Supported filters:
 *   - 'attack': keep entries with `attack_bonus` or `damage` declared.
 *               Anything else (pure description) is dropped.
 *
 * @returns Array<object> - actions in original declaration order.
 */
export function resolveCharacterActions(character, config = {}) {
  const actions = Array.isArray(character?.actions) ? character.actions : [];
  if (config.filter === 'attack') {
    return actions.filter((a) => a?.attack_bonus !== undefined || a?.damage);
  }
  return actions;
}

/**
 * Pull `character.spell_ids[]` resolved against `state.spells`. Each
 * returned record gains an `available` boolean: true for cantrips
 * (level 0/missing) and for leveled spells whose slots have at least
 * one unused unit.
 *
 * @returns Array<{ ...spell, available: boolean }>
 */
export function resolveSpellIds(character, state) {
  const ids = Array.isArray(character?.spell_ids) ? character.spell_ids : [];
  const slots = (character?.spell_slots && typeof character.spell_slots === 'object') ? character.spell_slots : {};
  const known = ids.map((id) => state?.spells?.get?.(id)).filter(Boolean);
  return known.map((s) => {
    const lvl = Number(s?.level ?? 0);
    if (lvl <= 0) return { ...s, available: true };
    const slot = slots[String(lvl)];
    const total = Number(slot?.total ?? 0);
    const used = Number(slot?.used ?? 0);
    return { ...s, available: total - used > 0 };
  });
}

/**
 * Pull `character.inventory_ids[]` and filter to consumables that
 * still have charges. A consumable is anything with
 * `consumable === true` OR `kind === 'consumable'`. Zero-qty entries
 * are dropped (no point offering "Use" with nothing left).
 *
 * Identical consumables (same name + description) are coalesced into a
 * single entry with summed quantity so the play-actions panel doesn't
 * show two identical "Healing Potion × 1" buttons when the character
 * carries two single-qty stacks.
 */
export function resolveInventoryConsumables(character, state) {
  const ids = Array.isArray(character?.inventory_ids) ? character.inventory_ids : [];
  const items = ids.map((id) => state?.items?.get?.(id)).filter(Boolean);
  const live = items.filter((it) => {
    const isCons = it.consumable === true || it.kind === 'consumable';
    if (!isCons) return false;
    const qty = Number(it.quantity ?? 1);
    return qty > 0;
  });
  // Coalesce by identity (name + description). The first stack's id is
  // kept so the "Use" handler still points at a real inventory entry -
  // ui.consumeItem decrements the first stack first, then the next, etc.
  const byIdentity = new Map();
  for (const it of live) {
    const key = `${it.name}::${it.description ?? ''}`;
    const prior = byIdentity.get(key);
    const qty = Number(it.quantity ?? 1);
    if (prior) {
      prior.quantity = Number(prior.quantity ?? 1) + qty;
    } else {
      byIdentity.set(key, { ...it, quantity: qty });
    }
  }
  return Array.from(byIdentity.values());
}

/**
 * Pull ruleset-declared common actions (Dodge / Dash / etc. in 5e).
 * Source key `ruleset_common_actions`.
 */
export function resolveRulesetCommonActions(ruleset) {
  const list = ruleset?.combat?.common_actions;
  return Array.isArray(list) ? list : [];
}

const SOURCES = {
  character_actions:       (config, ctx) => resolveCharacterActions(ctx.character, config),
  spell_ids:               (_config, ctx) => resolveSpellIds(ctx.character, ctx.state),
  inventory_consumables:   (_config, ctx) => resolveInventoryConsumables(ctx.character, ctx.state),
  ruleset_common_actions:  (_config, ctx) => resolveRulesetCommonActions(ctx.ruleset),
};

/**
 * Dispatch a single group config to its source resolver.
 *
 * `groupConfig` shape: `{ source: 'character_actions' | 'spell_ids' |
 *   'inventory_consumables' | 'ruleset_common_actions', filter?: string }`
 *
 * `ctx` shape: `{ character, state, ruleset }`.
 *
 * Unknown sources return `[]` rather than throwing - keeps forward
 * compatibility with rulesets that reference sources a newer engine
 * adds.
 */
export function resolveGroup(groupConfig, ctx) {
  const fn = SOURCES[groupConfig?.source];
  if (!fn) return [];
  return fn(groupConfig, ctx);
}

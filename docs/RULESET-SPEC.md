# Ruleset Specification

A ruleset is a JSON data structure integrating a game system with MatrixVTT. It contains no executable code, permitting untrusted source import.

The VTT rules engine (`src/engine/`) processes ruleset fields to drive system calculations. The engine ignores undeclared fields, degrading functionality cleanly.

---

## File Structure

```jsonc
{
  "meta": { "name": "System Name", "version": "1.0.0", "author": "...", "license": "..." },
  "attributes": [ /* see §Attributes */ ],
  "dice": { /* see §Dice */ },
  "tables": { /* see §Tables */ },
  "formulas": { /* see §Formulas */ },
  "harm_model": { /* see §Harm model */ },
  "progression": { /* see §Progression */ },
  "state_machines": { /* see §State machines */ },
  "skills": [],
  "saves": [],
  "conditions": [],
  "spell_schools": [],
  "damage_types": []
}
```

---

## Attributes

Defines primary system statistics.

```jsonc
"attributes": [
  { "key": "str", "label": "Strength", "min": 1, "max": 30 },
  { "key": "dex", "label": "Dexterity", "min": 1, "max": 30 }
]
```

| Field   | Required | Description |
|---------|----------|-------------|
| `key`   | Yes      | Identifier for formula resolution (e.g., `@attrs.str.score`). |
| `label` | Yes      | Display name. |
| `min`/`max` | No   | Value boundaries. |

---

## Dice

Defines system roll parameters.

```jsonc
"dice": {
  "check": "1d20",
  "notation_variants": ["NdF"],
  "crit": { "low": 1, "high": 20 }
}
```

Supported notation (`src/engine/roll.js`):

| Notation  | Operation |
|-----------|-----------|
| `NdS`     | Sum N dice of S sides |
| `NdS+M`   | Sum with modifier |
| `NdF`     | Fudge dice (-1, 0, +1) |
| `NdS!`    | Explode on maximum |
| `NdSw`    | Wild die (explode max, complication on 1) |
| `NdSrM`   | Reroll values ≤ M once |
| `NdSkhK`  | Keep highest K |
| `NdSklK`  | Keep lowest K |
| `NdSdhK`  | Drop highest K |
| `NdSdlK`  | Drop lowest K |
| `NdS>T`   | Count successes > T |
| `NdS>=T`  | Count successes ≥ T |
| `{A\|B}+M` | Roll each group, keep the highest group total, then add M |

Grouped notation `{A|B}` accepts two or more `|`-separated groups; each group is any single-pool notation from the table (groups cannot nest). Every group is rolled, the highest group total wins, and a trailing modifier applies once to the winner. Example: `{1d8!|1d6!}+2` rolls an exploding d8 and an exploding d6 and keeps the higher, the Savage Worlds trait die plus wild die mechanic.

---

## Rolls

Defines resolution templates. Evaluated via context expansion prior to parsing.

```jsonc
"rolls": {
  "attribute": "1d20+{mod}",
  "skill": "1d20+{bonus}",
  "save": "1d20+{bonus}",
  "initiative": "1d20+{bonus}",
  "attack": "1d20+{bonus}"
}
```

| Variable    | Resolution |
|-------------|------------|
| `{bonus}`   | Interface element modifier |
| `{mod}`     | Computed attribute modifier |
| `{score}`   | Base attribute score |

---

## Tables

Key-value structures for discrete data lookups.

```jsonc
"tables": {
  "proficiency_by_level": { "1": 2, "5": 3, "9": 4, "13": 5, "17": 6 }
}
```

Resolution primitive: `lookupTable(table, key, { clamp })`
- `clamp: 'nearest'`: Bound to closest defined key.
- `clamp: 'floor'`: Bound to highest key ≤ input.
- Default: Exact match or `null`.

---

## Formulas

JSON-AST expressions processed via `src/engine/evaluate.js`.

```jsonc
"formulas": {
  "ability_mod": { "$": "floor", "args": [ { "$": "/", "args": [ { "$": "-", "args": ["@score", 10] }, 2 ] } ] }
}
```

### Syntax

| Form | Evaluation |
|------|------------|
| `5`, `true`, `null`, `"text"` | Literal |
| `"@path"` | Context path resolution |
| `{ "$": "op", "args": [...] }` | Operator execution |

### Operators

| Operator | Arity | Description |
|----------|-------|-------------|
| `+ - * /` | Variadic | Arithmetic |
| `floor ceil` | 1 | Rounding |
| `max min` | Variadic | Bounding |
| `eq lt gt` | 2 | Logical comparison |
| `if` | 3 | Conditional |
| `lookup` | 2 | Table access `[tableName, key]` |
| `sum_items`| 1-3 | Inventory aggregation `[field, filterField?, multiplyField?]` |

---

## Harm Model

Defines damage processing semantics.

```jsonc
// Pool
"harm_model": { "type": "pool", "track_key": "hp" }

// Tracks
"harm_model": { "type": "tracks", "tracks": ["hp", "fp"] }

// Stress
"harm_model": { "type": "stress", "boxes": [1, 2, 3, 4] }

// Wounds
"harm_model": { "type": "wounds", "thresholds": [ { "tier": "light", "max": 4 } ] }
```

Resolution primitive: `applyHarm(harmModel, entity, amount, kind?)`. Returns updated entity state.

---

## Progression

Specifies character advancement metrics.

```jsonc
// Level/XP
"progression": { "type": "levels_xp", "level_field": "level", "xp_table": "xp_by_level" }

// Point Buy
"progression": { "type": "points", "pool_field": "character_points" }

// Milestone
"progression": { "type": "milestones" }
```

---

## Character Sheet Composition

Defines interface layout components.

```jsonc
"character_sheet": {
  "sections": [
    { "kind": "resource_track", "id": "hp", "label": "HP", "current_field": "hp_current", "max_field": "hp_max" }
  ]
}
```

Supported Section Kinds (`src/ui/characterSheetSections.js`):
- `resource_track`, `stat_grid`, `attributes`, `saves`, `conditions`, `notes`, `stress_boxes`, `aspects`, `wounds`, `tagged_list`, `slot_list`, `box_track`, `resource_pool`, `button_action`, `pending_modifiers_list`
- NPC Specific: `action_list`, `actions`

---

## Character Creation Form

Defines entity generation parameters.

```jsonc
"character_form": {
  "fields": [
    { "kind": "row", "fields": [ { "kind": "text", "id": "species", "label": "Species" } ] }
  ]
}
```

Field Kinds (`src/ui/characterFormFields.js`): `text`, `number`, `textarea`, `row`, `attributes`

---

## Spellcasting

Defines spell categorization and tracking.

```jsonc
"spellcasting": {
  "group_by": "level",
  "level_labels": { "0": "Cantrips", "1": "1st Level" },
  "slot_levels": [1, 2, 3, 4, 5, 6, 7, 8, 9]
}
```

---

## Combat

Defines available discrete combat actions.

```jsonc
"combat": {
  "common_actions": [
    { "label": "Dodge", "description": "..." }
  ]
}
```

---

## Token Overlays

Controls map token interface elements (`src/map/render/tokenOverlays.js`).

```jsonc
"token": {
  "overlays": [
    { "kind": "resource_bar", "current_field": "hp_current", "max_field": "hp_max" }
  ]
}
```

Overlay Kinds: `resource_bar`, `pip_track`, `badge`

---

## Character Card

Configures status line rendering on entity lists (`src/ui/entity-card-overlays.jsx`).

```jsonc
"character_card": {
  "overlays": [
    { "kind": "pip_track", "field": "stress", "count": 6, "label": "Dice lost" }
  ]
}
```

---

## Item Card

Configures item card display (`src/ui/item-card-sections.js`).

```jsonc
"item_card": {
  "sections": [
    { "kind": "badge", "field": "rarity" }
  ]
}
```

Section Kinds: `badge`, `attack_line`, `description`, `stat_row`

---

## Preview Popups

Configures interactive preview modals.

```jsonc
"character_preview": { "sections": [] },
"npc_preview": { "sections": [] },
"item_preview": { "sections": [] },
"spell_preview": { "sections": [] }
```

Fallback Logic:
- `character`: `character_preview` → `character_sheet`
- `npc`: `npc_preview` → `npc_sheet` → `character_sheet`
- `item`: `item_preview` → `item_card`
- `spell`: `spell_preview` → empty

Preview Specific Kinds: `defenses`, `attack_roll`, `damage_roll`, `use_consumable`, `cast_spell`, `spell_damage_roll`, `spell_save_roll`, `spell_meta`, `higher_level`

---

## NPC Metadata

Configures NPC generation parameters.

```jsonc
"npc": {
  "has_cr": true,
  "has_alignment": true,
  "cr_values": ["0", "1/8"],
  "size_categories": ["Tiny", "Small"],
  "creature_types": ["Beast"]
}
```

---

## Initiative

Configures combat order resolution.

```jsonc
"initiative": {
  "mode": "individual",
  "tie_break_stat": "dex"
}
```

---

## State Machines

Manages iterative state updates. Resolution primitive: `runStateMachine(spec, state, input, extras?)`.

```jsonc
"state_machines": {
  "death_save": {
    "transitions": [ { "when": true, "set": {} } ],
    "resolve": { "status": "@state.status" }
  }
}
```

---

## Domain Vocabularies

Presentation data definitions for: `skills`, `saves`, `conditions`, `spell_schools`, `damage_types`.

---

## Conformance Requirements

Minimum required fields:
- `meta.name`
- `attributes`
- `dice.check`

---

## Versioning

- `meta.version`: Ruleset content version.
- `meta.spec_version`: Engine compatibility target (Current: `"1.0"`). Validated via `src/engine/validateRuleset.js`.

# Ruleset (`.vttruleset.json`)

A **ruleset** defines the game system a session uses: attributes, dice, derived-value formulas, harm model, and optional domain vocabularies (skills, conditions, saves, etc.).

The full schema - every field the app's engine reads - is **[RULESET-SPEC.md](/RULESET-SPEC)**. This page is a quick-start for authors; the spec is authoritative.

Uploading a `.vttruleset.json` in the setup wizard (or via **Settings → Import Ruleset**) validates the file and loads it as the active ruleset. Imports that fail validation are rejected with a toast describing the first error.

## Nine fixtures ship with the app

You can start by copy-pasting any of these and modifying in place:

| File | System | Dice shape |
|------|--------|-----------|
| `src/content/rulesets/dnd5e.json` | D&D 5e SRD | `1d20` |
| `src/content/rulesets/fate.json`  | FATE Core | `4dF` |
| `src/content/rulesets/gurps.json` | GURPS (minimal) | `3d6` |
| `src/content/rulesets/ose.json`   | Old-School Essentials | `1d20`, class-based attack tables |
| `src/content/rulesets/pbta.json`  | Powered by the Apocalypse | `2d6` |
| `src/content/rulesets/wod.json`   | World of Darkness | d10 pool vs target |
| `src/content/rulesets/opend6.json` | OpenD6 | d6 pool with wild die |
| `src/content/rulesets/savage-worlds.json` | Savage Worlds | per-trait exploding die + wild |
| `src/content/rulesets/risus.json` | Risus | `Nd6` cliché pool |

## Minimum viable ruleset

```json
{
  "vtt_export_type": "ruleset",
  "meta":       { "name": "My System", "version": "0.1.0" },
  "attributes": [{ "key": "a", "label": "Aptitude" }],
  "dice":       { "check": "1d20" }
}
```

The `vtt_export_type: "ruleset"` marker is required for import. Everything under `meta`, `attributes`, and `dice` is validated against the spec.

## Optional fields (expand as needed)

| Field              | Purpose                                           | Example |
|--------------------|---------------------------------------------------|---------|
| `tables`           | named lookup tables (`key → value`)               | `proficiency_by_level: {"1": 2, "5": 3}` |
| `formulas`         | named JSON-AST expressions                        | `ability_mod: {"$": "floor", "args": [...]}` |
| `harm_model`       | how damage is tracked: `pool` / `tracks` / `stress` / `wounds` | `{"type": "pool", "track_key": "hp"}` |
| `state_machines`   | FSM specs for death saves / stress / exhaustion   | see RULESET-SPEC §State machines |
| `character_sheet`  | `{sections: [{kind, ...config}]}` - composes the PC sheet body | `{"kind":"resource_track","id":"hp",...}` |
| `npc_sheet`        | same as `character_sheet` but for NPCs (falls back to PC sections if absent) | includes `{"kind":"actions"}` typically |
| `npc`              | metadata form block: `has_cr`, `has_alignment`, `cr_values[]`, `size_categories[]`, `creature_types[]` | absent ⇒ no CR/size/alignment inputs |
| `rolls`            | per-slot click-to-roll templates                  | `{"attribute":"1d20+{mod}","skill":"1d20+{bonus}"}` |
| `initiative`       | turn order mode and tie-breaker                   | `{"mode": "individual", "tie_break_stat": "dex"}` |
| `progression`      | levels + XP, points-buy, milestones              | `{"type": "levels_xp", "level_field": "level"}` |
| `skills[]`         | skill list rendered on the sheet                  | `{"key":"athletics","label":"Athletics","attribute":"str"}` |
| `saves[]`          | save list; empty array = system has no saves      | `{"key":"dex","label":"Dexterity","attribute":"dex"}` |
| `conditions[]`     | status-effect list                                | `{"key":"prone","label":"Prone","icon":"⬇️"}` |
| `damage_types[]`   | for item/spell pickers                            | `{"key":"fire","label":"Fire"}` |
| `spell_schools[]`  | for spell pickers                                 | `{"key":"evocation","label":"Evocation"}` |

Anything not declared simply means "this system doesn't have that concept." The engine returns `null` and the UI hides the corresponding widget.

## Formula grammar (quick reference)

Formulas are JSON-AST - no strings parsed, no code executed.

```jsonc
{
  "$": "+",                                      // operator
  "args": [8, "@derived.pb", "@cast.mod"]        // operands
}
```

Values in `args`:
- numeric/boolean/null/string literals
- `"@path.to.value"` - resolved from the evaluation context
- another `{ "$": op, "args": [...] }` - nested

Operators: `+`, `-`, `*`, `/`, `floor`, `ceil`, `max`, `min`, `eq`, `lt`, `gt`, `if`, `lookup`, `sum_items`. See [RULESET-SPEC §Formulas](/RULESET-SPEC#formulas) for full details and examples.

## Attributes

```json
{
  "key":   "str",
  "label": "Strength",
  "min":   1,
  "max":   30
}
```

`key` is referenced in formulas and character sheets. `min`/`max` are optional bounds for character creation.

## Harm models

Pick the shape that matches your system:

```jsonc
{ "type": "pool",    "track_key": "hp" }                         // 5e, OSR
{ "type": "tracks",  "tracks": ["hp", "fp"] }                    // GURPS
{ "type": "stress",  "boxes": [1, 2, 3] }                        // FATE
{ "type": "wounds",  "thresholds": [{"tier":"light","max":4}] }  // Rolemaster-ish
```

## Validating your ruleset

Before shipping a ruleset, run it through the validator:

```js
import { validateRuleset } from './src/engine/validateRuleset.js';
import mine from './my-ruleset.json';

const { valid, errors, warnings } = validateRuleset(mine);
console.log({ valid, errors, warnings });
```

Importing into the app surfaces the same errors as toast messages.

## Export

Exported rulesets include the spec fields plus a `vtt_export_type: "ruleset"` marker and a `system` slug. The slug is used on subsequent imports to identify the ruleset without extra UI state.

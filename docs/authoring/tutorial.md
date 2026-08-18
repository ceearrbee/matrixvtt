# Authoring a Ruleset - 30-Minute Tutorial

This walkthrough builds a small custom ruleset ("Embergate, a Narrative Fire-Mage System") from scratch, loads it into MatrixVTT, and verifies every surface that matters. At the end you'll know:

- Every required and optional field the engine reads
- Where to borrow from the nine shipped fixtures
- How to validate your work before shipping

Prerequisite: a local MatrixVTT checkout (`npm install && npm run dev`).

---

## 1 - Skeleton

The minimum viable ruleset is four lines:

```json
{
  "meta":       { "name": "Embergate", "version": "0.1.0", "spec_version": "1.0" },
  "attributes": [{ "key": "heat", "label": "Heat" }],
  "dice":       { "check": "2d6" },
  "vtt_export_type": "ruleset"
}
```

Save this as `embergate.vttruleset.json`. The `vtt_export_type` marker is how the importer distinguishes ruleset files from campaign archives. Drop it into the app via **Settings → Import Ruleset**. The validator tells you what (if anything) it rejected.

---

## 2 - Attributes

Embergate uses five narrative axes. Replace the single-attribute stub:

```json
"attributes": [
  { "key": "heat",   "label": "Heat",   "min": 0, "max": 10 },
  { "key": "resolve","label": "Resolve","min": 0, "max": 10 },
  { "key": "craft",  "label": "Craft",  "min": 0, "max": 10 },
  { "key": "sense",  "label": "Sense",  "min": 0, "max": 10 },
  { "key": "bond",   "label": "Bond",   "min": 0, "max": 10 }
]
```

Reload the ruleset. The character sheet's attribute grid now shows all five.

---

## 3 - Derived values via formulas

Embergate's moves use `2d6 + attribute`. Declare a formula so the sheet's click-to-roll bar uses the right expression:

```json
"rolls": {
  "attribute": "2d6+{mod}"
}
```

And a derived "Intensity" = Heat + Resolve - 5 that the sheet can display:

```json
"formulas": {
  "intensity": {
    "$": "-",
    "args": [
      { "$": "+", "args": ["@attrs.heat.mod", "@attrs.resolve.mod"] },
      5
    ]
  }
}
```

`@attrs.heat.mod` resolves from the character-sheet evaluation context the engine builds - see [RULESET-SPEC §Evaluation context](../RULESET-SPEC.md#evaluation-context).

---

## 4 - Harm model

Embergate uses **stress boxes**. Declare two tracks: Body (three boxes, capacities 2/4/6) and Spirit (three boxes, capacities 1/3/5).

Simplest choice - stress:

```json
"harm_model": { "type": "stress", "boxes": [2, 4, 6] }
```

If you want two independent tracks, pick `tracks`:

```json
"harm_model": { "type": "tracks", "tracks": ["body", "spirit"] }
```

The engine's `applyHarm(harmModel, character, amount, kind?)` routes damage accordingly - no code change needed.

---

## 5 - Character sheet composition

Tell the engine which sections the PC sheet renders, and in what order:

```json
"character_sheet": {
  "sections": [
    { "kind": "attributes" },
    { "kind": "stress_boxes" },
    { "kind": "notes" }
  ]
}
```

Full list of section kinds lives in [RULESET-SPEC §Character sheet composition](../RULESET-SPEC.md#character-sheet-composition). Unknown kinds silently skip, so a ruleset can declare a `wounds` kind even if no character has wounds yet.

---

## 6 - Character creation form

Mirror the section list for the New Character modal:

```json
"character_form": {
  "fields": [
    { "kind": "text", "id": "archetype", "label": "Archetype" },
    { "kind": "attributes" },
    { "kind": "textarea", "id": "notes", "label": "Notes" }
  ]
}
```

Input IDs become `entity-archetype` (the form's submit reader picks them up by kebab-casing the `id`).

---

## 7 - Validate

Before shipping, run your ruleset through the validator - either in-app (**Settings → Validate Ruleset**) or in code:

```js
import { validateRuleset } from './src/engine/validateRuleset.js';
import mine from './embergate.vttruleset.json';

const { valid, errors, warnings } = validateRuleset(mine);
console.log({ valid, errors, warnings });
```

Warnings are not fatal - the ruleset still loads, and the app surfaces them as toasts.

---

## 8 - Ship

Hand the `.vttruleset.json` file to your GM. They import it via **Settings → Import Ruleset**. The room's `settings.systemConfig` is now your ruleset - all characters, sheets, rolls, and combat consult it at runtime.

---

## Pool systems: named pools, dice lost, opposed rolls

Rules-light systems where characters are a handful of named dice pools (Risus is the shipped example: `src/content/rulesets/risus.json`) come together from five declarations. Everything below is data; no code changes.

1. **Attributes are the ratings, a `slot_list` holds the names.** Give both the same keys:

```jsonc
"attributes": [
  { "key": "pool1", "label": "Pool 1 dice", "min": 0, "max": 6 },
  { "key": "pool2", "label": "Pool 2 dice", "min": 0, "max": 6 }
],
"character_sheet": { "sections": [
  { "kind": "slot_list", "field": "pools", "label": "Pools", "slots": [
    { "key": "pool1", "label": "Pool 1" },
    { "key": "pool2", "label": "Pool 2" }
  ]},
  { "kind": "attributes" }
]}
```

Shared keys activate slot ↔ attribute pairing: the attribute cards take the character's own names ("Swashbuckler", not "Pool 1 dice"), unnamed zero-rated slots hide, and the named pools render as roll buttons on the combat tab and sidebar.

2. **Rolls expand the rating into a pool.** `"rolls": { "attribute": "{bonus}d6" }` - a 4-rated pool rolls 4d6, a 0-rated pool rolls nothing and totals 0.

3. **Harm is dice lost.** All-capacity-1 stress boxes make the map's Damage action tick one box per point:

```jsonc
"harm_model": { "type": "stress", "boxes": [1, 1, 1, 1, 1, 1] }
```

Add a matching `box_track` sheet section and a `pip_track` in `token.overlays` and `character_card.overlays` so the lost dice show on the sheet, the token, and the list card.

4. **Combat is opposed.** With a stress harm model and paired slots, rolling a pool on your turn with an enemy token selected resolves automatically: the defender answers with their highest-rated pool (dice from your `rolls.attribute` template), both totals post to chat, and the loser's token ticks a lost die. Declare `"action_economy": []` to drop the d20 Action/Bonus/Reaction pips, and put your system's combat rules in `combat.common_actions` as a click-to-announce reference.

5. **The card line.** `character_card.overlays` with the `text` kind and `with_attribute_ratings: true` prints "Swashbuckler 4 · Hacker 3" on the roster card.

---

## When to borrow from a shipped fixture

`src/content/rulesets/` has nine worked examples:

| File | Use it when… |
|------|--------------|
| `dnd5e.json`   | you're building anything d20-style (5e, 3.5, Pathfinder-ish) |
| `fate.json`    | narrative system with stress boxes and aspects |
| `gurps.json`   | point-buy with HP + FP tracks |
| `ose.json`     | class-based OSR with named saves (Death/Wands/Paralysis…) |
| `pbta.json`    | 2d6 moves with graduated results |
| `wod.json`     | d10 dice pools against a target number |
| `opend6.json`  | d6 pools with a wild die |
| `savage-worlds.json` | exploding trait dice with a wild die |
| `risus.json`   | freeform traits as dice pools (clichés, paired slot + rating) |

Copy the closest fixture, rename `meta.name`, delete fields that don't apply, and iterate with the in-app validator panel open.

---

## Further reading

- [RULESET-SPEC.md](../RULESET-SPEC.md) - authoritative schema
- [DATA-MODEL-SPEC §2](../DATA-MODEL-SPEC.md#2-ruleset-systemconfig) - where rulesets fit in room state
- `src/engine/` - the seven primitives every ruleset runs against

# MatrixVTT Data Model Specification

**Version:** 1.0
**Scope:** Persisted Matrix room state and local browser preferences.
**Related Specifications:** `EVENT-SCHEMA.md`, `ARCHITECTURE.md`, `MATRIX-INTEGRATION.md`, `RULESET-SPEC.md`.

## 1. Architecture Constraints
MatrixVTT is a serverless client. State is stored via Matrix room state events (`com.vtt.*`). Client-local preferences are maintained in browser `localStorage`. The homeserver enforces Matrix authentication, power levels, and rate limits. Schema validation and game logic are strictly client-enforced.

## 2. Ruleset Engine
Game mechanics are defined by external JSON files (`src/content/rulesets/*.json`) conforming to `RULESET-SPEC.md`. 
**Context:**
- `settings.system`: Active ruleset identifier.
- `settings.systemConfig`: Hydrated ruleset object.

**Engine API (`src/engine/`):**
- `evaluate(formula, ctx)`: Computes AST formulas.
- `computeDerived(cfg, name, ctx)`: Calculates derived statistics.
- `lookupTable(table, key, {clamp})`: Resolves table entries.
- `rollNotation(notation, {rng})`: Evaluates dice notation.
- `applyHarm(model, entity, amt, kind?)`: Processes health modifications.
- `runStateMachine(spec, state, input)`: Executes state transitions.

## 3. State Entities
Entities are written as state events. Tombstoning (deletion) requires an empty object payload `{}`.

### Character (`com.vtt.character`)
Key: `id`. Represents a Player Character.
Attributes: `id`, `type: 'pc'`, `name`, `player_user_id`, `token_id`, `species`, `class_level`, `level`, `hp_max`, `hp_current`, `ac`, `attributes`, `skills`, `inventory_ids`, `spell_ids`.

### NPC (`com.vtt.npc`)
Key: `id`. Represents a Non-Player Character.
Extends Character. Additional attributes: `cr`, `size_category`, `creature_type`, `alignment`, `is_hidden`, `actions`.

### Token (`com.vtt.token`)
Key: `id`. Represents an entity on the map grid.
Attributes: `id`, `col`, `row`, `size`, `sheet_id`, `hp_current`, `ac`, `visible`, `conditions`, `aura_radius`.

### Initiative (`com.vtt.initiative`)
Key: `''` (Singleton).
Attributes: `active`, `round`, `current_index`, `order` (Array of InitiativeEntry).
Modes (`systemConfig.initiative.mode`): `individual`, `side`, `static`.

### Item (`com.vtt.item`)
Key: `id`.
Attributes: `id`, `name`, `type`, `quantity`, `equipped`, `damage`, `attack_bonus`.

### Spell (`com.vtt.spell`)
Key: `id`.
Attributes: `id`, `name`, `level`, `school`, `casting_time`, `range`, `damage`, `save_ability`, `concentration`.

### Map (`com.vtt.map`)
Key: `id`.
Attributes: `id`, `width_cells`, `height_cells`, `cell_px`, `image_url`.

### Fog of War (`com.vtt.fog`)
Key: `''` (Singleton).
Attributes: `mode`, `revealed` (Array of string coordinates).

### Drawing (`com.vtt.drawing`)
Key: `id`.
Attributes: `id`, `type`, `color`, `width`, spatial parameters (`points`, `r`, `x`, `y`, `w`, `h`).

### Handout (`com.vtt.handout`)
Key: `id`.
Attributes: `id`, `title`, `body`, `visible_to` (Array of user IDs).

### Table (`com.vtt.table`)
Key: `id`.
Attributes: `id`, `name`, `entries` (Array of ranges and results), `dice`.

### Settings (`com.vtt.settings`)
Key: `''` (Singleton).
Attributes: `gm_user_ids`, `name`, `system`, `grid_px`, `active_map_id`.

## 4. Ephemeral Events
Timeline events bypass state synchronization.
- `com.vtt.ping`: Visual map marker broadcast.
- `com.vtt.speak_as_token`: Token-attributed chat message.
- `com.vtt.damage_event`: Audit trail log for health modification.

## 5. Client Preferences

**Session Storage (`sessionStorage`):**
- `vtt-auth-session`: Matrix access token.
- `vtt:retry-queue`: Rate-limited state-event queue.

**Local Storage (`localStorage`):**
- `vtt-theme`: UI theme.
- `vtt:combat-automation`: GM automation configuration.
- `vtt:accessibility`: Client rendering overrides.
- `vtt:dice-macros`: User-defined dice expressions.
- `vtt:audio-volume`: Local playback volume.

## 6. Operation Constraints

1. **Transaction Commit:** Local UI updates commit to Matrix solely upon interaction completion.
2. **Boundary Validation:** Spatial coordinates must be clamped to map boundaries prior to transmission.
3. **Queue Deduplication:** Consecutive identical entity states collapse in the transmission queue.
4. **Optimistic Execution:** Local state mutates instantly; transactions revert on transmission failure.
5. **Entity ID Allocation:** Positional IDs (`tok-1`, `chr-2`) are allocated sequentially via `allocateEntityIdSafe` to mitigate server state growth and collision.
6. **Rate Limiting:** HTTP 429 responses trigger queue suspension and automatic retry. Over-limit payloads (>63 KB) abort.

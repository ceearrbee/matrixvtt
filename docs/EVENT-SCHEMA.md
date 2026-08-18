# MatrixVTT Event Schema

This document defines the Matrix state and timeline events for MatrixVTT.

## State Events

State events persist in the room and define current game state. Each event type is stored with a unique `state_key` identifier.

### `com.vtt.settings`
- **State Key:** `""` (singleton)
- **Description:** Room-level configuration payload.
- **Payload:**
  - `name` (string): Session display name.
  - `system` (string): Game system identifier (e.g., `"dnd5e"`, `"pf2e"`).
  - `gm_user_ids` (array): Matrix user IDs indicating Game Master privileges.
  - `grid_px` (number): Default grid cell pixel dimension.
  - `active_map_id` (string|null): State key of the active `com.vtt.map.$id` entity.
  - `created_at` (number): Initialization Unix timestamp.

### `com.vtt.map.$id`
- **State Key:** Unique map ID.
- **Description:** Encapsulates localized map properties.
- **Payload:**
  - `name` (string): Map display name.
  - `image_url` (string): Matrix content URI (`mxc://`) representing the map image.
  - `width_cells` (number): X-axis cell capacity.
  - `height_cells` (number): Y-axis cell capacity.
  - `cell_px` (number): Pixel mapping equivalent to one grid cell.
  - `offset_x`, `offset_y` (number): Panning coordinate offsets.

### `com.vtt.fog`
- **State Key:** `""` (singleton)
- **Description:** Client-side fog of war configuration.
- **Payload:**
  - `mode` (string): `"hidden"` (dark except revealed) or `"visible"` (fog globally disabled).
  - `revealed` (array): Visible `"col,row"` coordinate identifiers.
  - `version` (number): Monotonically-increasing integer for optimistic concurrency gating.

### `com.vtt.initiative`
- **State Key:** `""` (singleton)
- **Description:** Turn-based combat tracking payload.
- **Payload:**
  - `active` (boolean): Execution status.
  - `round` (number): Current numerical round.
  - `current_index` (number): Array index mapping to active order sequence.
  - `order` (array): Sequenced tracking objects.
    - `id` (string): Unique order entry identifier.
    - `token_id` (string): `com.vtt.token` reference.
    - `character_id` (string): Reference identifier to underlying sheet configuration.
    - `name` (string): Display name.
    - `initiative` (number): Sorting sequence integer.
    - `hp_current`, `hp_max` (number): Localized UI caching.

### `com.vtt.token.$id`
- **State Key:** Unique token ID.
- **Description:** Map entity representation.
- **Payload:**
  - `name` (string): Primary token label.
  - `type` (string): Classification parameter (`"pc"`, `"npc"`, `"object"`).
  - `color` (string): Indicator hex color sequence.
  - `col`, `row` (number): Grid placement coordinates (0-indexed).
  - `hp_current`, `hp_max` (number): Hit point bounds.
  - `ac` (number): Armor class computation cache.
  - `size` (number): Volumetric footprint in grid cells.
  - `conditions` (array): Assigned condition states.
  - `sheet_id` (string|null): Relational link to `com.vtt.character` or `com.vtt.npc`.
  - `owner_user_id` (string|null): Matrix user ID with ownership permissions.
  - `image_url` (string|null): Matrix content URI mapping.

### `com.vtt.character.$id`
- **State Key:** Unique character ID.
- **Description:** Player character telemetry construct.
- **Payload:**
  - `name` (string): Full entity name.
  - `player_user_id` (string): Mapping to matrix controller.
  - `token_id` (string): Relation link to `com.vtt.token`.
  - `species` (string): Character classification.
  - `class_level` (string): Character advancement structure.
  - `hp_max`, `hp_current` (number): Real-time hit point data.
  - `ac` (number): Base armor class logic cache.
  - `speed` (number): Navigational traversal boundary.
  - `initiative_bonus` (number): Sequence modifier constant.
  - `attributes` (object): System-dependent ability score map.
  - `skills` (object): Skill modifier dictionary.
  - `saving_throws` (object): Save capability array.
  - `conditions` (array): Retained condition parameters.
  - `inventory_ids` (array): Link array mapped to `com.vtt.item` structures.
  - `notes` (string): Arbitrary user documentation.

### `com.vtt.npc.$id`
- **State Key:** Unique NPC ID.
- **Description:** Non-player character definition schema.
- **Payload:**
  - `name` (string): Identification label.
  - `cr` (string): Difficulty designation constant.
  - `size_category` (string): Volumetric categorization label.
  - `hp_max`, `hp_current` (number): Health tracking mechanism.
  - `ac` (number): Defense calculation integer.
  - `speed` (number): Maximum coordinate displacement rate.
  - `attributes` (object): Native score map.
  - `actions` (array): Action definitions block.
    - `name` (string): Action label.
    - `description` (string): Unstructured behavior explanation.
    - `attack_bonus` (number|null): Modifying probability parameter.
    - `damage` (string|null): Resolution logic expression.
    - `damage_type` (string|null): System-defined type marker.
  - `is_hidden` (boolean): Render visibility toggle (enforced client-side).
  - `notes` (string): Associated reference data.

### `com.vtt.item.$id`
- **State Key:** Unique item ID.
- **Description:** Inventory logic definitions.
- **Payload:**
  - `name` (string): Primary identification label.
  - `type` (string): Categorization identifier (`"weapon"`, `"armor"`, etc.).
  - `rarity` (string): Statistical rarity sequence.
  - `description` (string): Item mechanics payload.
  - `quantity` (number): Inventory unit multiplier.
  - `weight` (number): Encumbrance unit.
  - `properties` (array): Boolean definition strings.
  - `attack_bonus` (number|null): Weapon usage modifier.
  - `damage` (string|null): Evaluator schema object.
  - `damage_type` (string|null): Classification system string.
  - `ac_bonus` (number|null): Armor configuration cache.
  - `value` (string): Economic baseline.
  - `image_url` (string|null): Image resource URI.

## Timeline Events

Timeline events function as ephemeral operational broadcasts and do not mutate persistent state boundaries.

### `com.vtt.roll`
- **Description:** Probabilistic computation result schema.
- **Payload:**
  - `expression` (string): Mathematical logic statement.
  - `results` (array): Numeric breakdown.
  - `modifiers` (number): Applied constants.
  - `total` (number): Aggregate derived sum.
  - `label` (string): Action string representation.
  - `is_private` (boolean): Roll visibility bounds.
  - `roller_token_id` (string|null): Entity source origin.
  - `timestamp` (number): Transmission milliseconds.

### `com.vtt.damage_event`
- **Description:** Health reduction broadcast block.
- **Payload:**
  - `target_token_id` (string): Subject parameter.
  - `amount` (number): Numeric scale of modification.
  - `type` (string): Descriptive evaluation identifier.
  - `new_hp` (number): Final parameter result.
  - `source_token_id` (string|null): Origin parameter.

### `com.vtt.condition_change`
- **Description:** State indicator transition notification.
- **Payload:**
  - `token_id` (string): Operational target.
  - `added` (array): Conditions transitioned to true.
  - `removed` (array): Conditions transitioned to false.

### `com.vtt.ping`
- **Description:** Transient interface locator notification. Replaces legacy `com.vtt.cursor`.
- **Payload:**
  - `x_frac` (integer): Horizontal fraction (0-10000).
  - `y_frac` (integer): Vertical fraction (0-10000).
  - `color` (string): Visual specification target.
  - `ts` (integer): Broadcast Unix execution time.

## Permissions Map

| Schema Namespace | Authorization Floor | Operation Scope |
|---|---|---|
| `com.vtt.settings` | 100 | Environment initialization |
| `com.vtt.map` | 50 | Cartographic modifications |
| `com.vtt.fog` | 50 | Fog-of-war logic modification |
| `com.vtt.initiative` | 50 | Turn-based state modification |
| `com.vtt.npc` | 50 | NPC definitions and manipulation |
| `com.vtt.condition_change` | 50 | Administrative condition modification |
| `com.vtt.token` | 0 | Token entity positioning |
| `com.vtt.character` | 0 | Character metadata alterations |
| `com.vtt.item` | 0 | Object manipulation logic |
| `com.vtt.roll` | 0 | Subroutine computations |
| `com.vtt.damage_event` | 0 | Action modifications |
| `com.vtt.ping` | 0 | Locator projections |

## System Conventions
- Namespace Prefix: `com.vtt.*`
- Identifier Formats: `tok-`, `chr-`, `npc-`, `itm-`.
- Blob Storage Formats: `mxc://`
- Timeline Mapping: Unix epoch metrics (ms).

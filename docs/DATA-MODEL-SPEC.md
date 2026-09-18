# MatrixVTT Data Model Specification

**Scope:** what MatrixVTT persists, and where.
**Related:** `EVENT-SCHEMA.md`, `ARCHITECTURE.md`, `MATRIX-INTEGRATION.md`, `RULESET-SPEC.md`.

## 1. Architecture constraints

MatrixVTT is a static browser client with no server of its own. The
Matrix homeserver is the only enforcement point: it authenticates
users, applies power levels, and rate-limits writes. Schema validation
and game rules are client-enforced and therefore advisory. See
`SECURITY-NOTES.md` for what that does and does not protect.

## 2. Where state lives

Three stores, with different durability and different trust:

| Store | Holds | Durability |
|---|---|---|
| Yjs document | every campaign entity | Matrix timeline + snapshot state events |
| Matrix room state | membership, power levels, join rules, the library | the room itself |
| Browser storage | per-user preferences, unsent work | the browser |

### 2.1 The Yjs document

All campaign entities live in one `Y.Doc` (`src/state/YjsManager.js`).
It is a CRDT, so concurrent edits from several clients merge without a
last-write-wins guard and without an app-level version field.

Seventeen keyed collections, each a `Y.Map` of `id` to entity:
`tokens`, `characters`, `npcs`, `items`, `spells`, `handouts`,
`tables`, `walls`, `lights`, `pins`, `templates`, `maps`, `pages`, and
the singleton-shaped `fog`, `initiative`, `settings`, each keyed by the
empty string. One `Y.Array`, `drawings`, because stroke history is
append-shaped.

Deletion removes the key. There is no empty-object tombstone in the
document; tombstones survive only in the snapshot chunks described in
`EVENT-SCHEMA.md`.

### 2.2 Matrix room state

Room state carries what the homeserver must enforce or a non-VTT
client must read: `m.room.power_levels`, `m.room.member`,
`m.room.join_rules`, `m.room.name`, the canonical alias, plus the
chunked Yjs snapshot. The personal content library (`com.vtt.library`,
`com.vtt.library_entry`) lives in its own room, never a campaign room.

The `com.vtt.*` entity event types still exist in
`src/utils/constants.js`. They name validation targets and let a room
written by an older build still load; they are not the live write
path. No writer under `src/state/writers/` calls `sendStateEvent`, and
`sendStateEventBoundary.test.js` holds that line with an empty
allowlist.

### 2.3 Browser storage

Per-user preferences (theme, reduced motion, layout, dice macros, turn
notifications) and unsent work (the Matrix retry queue, the Yjs pending
buffer). Anything that outlives a logout is user-scoped through
`src/utils/user-storage.js`; unsent work is additionally room-scoped
through `src/state/pending-storage.js`.

## 3. Entity shapes

Entities are plain JSON objects validated on the way in by
`src/utils/schemas/`. The fields below are the ones other parts of the
system depend on; each schema file is the full answer.

- **Character / NPC:** `id`, `name`, `hp_max`, `hp_current`, `ac`,
  `attributes`, `skills`, `inventory_ids`, `spell_ids`. A character
  names its player with `player_user_id`; an unclaimed one is taken by
  writing `claimed_by_user_id`.
- **Token:** `id`, `map_id`, `sheet_id`, `col`, `row`, `size`,
  `disposition`, `owner_user_id`, `vision_radius`,
  `darkvision_radius`, `auras`, `trackers`, `variants`, `conditions`,
  `condition_durations`. `map_id` is written once at creation; travel
  pins are the only path that rewrites it.
- **Map:** `id`, `name`, `width_cells`, `height_cells`, `cell_px`,
  `grid_type`, `image_url` or a `layers[]` stack. Images are `mxc://`
  URIs, so a map is only renderable to clients that can reach the
  homeserver that holds it.
- **Fog:** `mode` (`visible` or `hidden`) and `revealed`, an array of
  `"col,row"` strings. One fog record per map.
- **Handout:** `visible_to_players`, a boolean. Visibility is all
  players or none; there is no per-player targeting.
- **Page:** `kind` (journal, lore, fiction, prep) and `visibility`
  (private, gm, players).

## 4. Rulesets

Game mechanics come from JSON conforming to `RULESET-SPEC.md`.
`settings.system` names the active ruleset and `settings.systemConfig`
holds the hydrated object. Engine entry points live in `src/engine/`:
`evaluate`, `computeDerived`, `lookupTable`, `rollNotation`,
`applyHarm`, `runStateMachine`.

## 5. Limits worth knowing

- A Matrix event is capped near 64 KB, and the signed form is larger
  than the wire form. Snapshots are chunked and updates are held to a
  conservative binary size; `EVENT-SCHEMA.md` carries the numbers.
- Map images are shrunk client-side before upload and retried smaller
  if the homeserver rejects them.
- The Yjs document keeps its full operation history. A very long
  campaign pays for that in snapshot size and load time; Settings then
  About reports the current size.

# MatrixVTT Event Schema

Every Matrix event MatrixVTT sends or reads. `DATA-MODEL-SPEC.md`
covers what the entities mean; this covers what goes on the wire.

## 1. The Yjs transport

Campaign state is one CRDT document replicated over Matrix. Three
event types carry it.

### `com.matrixvtt.yjs.update` (timeline)

One binary Yjs update, base64-encoded. Any joined member may send one,
which is why the data plane is not a security boundary.

- `payload` (string): base64 of the Yjs update.
- `seq` (string): sender-unique sequence id, for chunk reassembly.
- `chunk` / `chunks` (number, optional): present only on a split update.

Updates are coalesced over a short window and merged with
`Y.mergeUpdates` before sending, because one event per keystroke
invites a rate limit. Binary chunks are held to 24000 bytes: after
base64 and the signed canonical-JSON envelope, homeservers reject well
below the advertised 64 KB.

Timeline events age out of the initial sync window and nothing
backfills them, so an update that is never folded into a snapshot is
lost to anyone loading the room later. That is what snapshots are for.

### `com.matrixvtt.yjs.snapshot` (state, PL 50)

The durable copy of the document, written by a GM. Debounced about 15
seconds after edits settle, with a periodic flush.

- **State key:** `${marker}-${index}` for a chunked snapshot, or the
  bare marker for a single-event one written by an older build.
- `payload` (string): base64 of the encoded document state.
- `generation` (string): the snapshot marker this chunk belongs to.

Superseded generations are tombstoned with an empty object, which is
the only place an empty-object tombstone still appears.

### `com.matrixvtt.yjs.sync_vector` (timeline)

Gossip for repair. A client broadcasts its state vector; peers elect
one responder, which replies with a differential update covering only
what the asker lacks. An oversized diff triggers a fresh snapshot
instead. This is how a client that was offline catches up without
waiting for the GM.

## 2. Room state MatrixVTT reads or writes

- `m.room.power_levels`: the only source of GM authority. `isGM()`
  reads it, never `settings.gm_user_ids`.
- `m.room.member`: membership, including `knock` for join requests.
- `m.room.join_rules`: invite, knock, or public.
- `m.room.name`, `m.room.canonical_alias`, `m.room.tombstone`.
- `com.vtt.library`, `com.vtt.library_entry`: the personal content
  library, in its own room. An entry is capped at 60000 bytes.

The `com.vtt.*` entity types (`com.vtt.token`, `com.vtt.character` and
the rest) are still defined in `src/utils/constants.js`. They name
validation targets and let rooms written by older builds load. They
are not written any more: entity state goes into the Yjs document.

## 3. Timeline events for play

- `m.room.message`: chat. `m.text` for in-character, `m.emote` for
  described actions, `m.notice` for out-of-character. Extra content
  fields: `com.vtt.speak_as_token` (persona), `com.vtt.tone`,
  `com.vtt.scene_root` and `com.vtt.scene_title` (a scene is a thread
  root), `whisper_to`.
- `m.reaction`: emoji reactions, with redaction to remove.
- `com.vtt.damage_event`: an entry in the shared damage log.
- `com.vtt.ping`: a transient map ping.

## 4. Threading

Scenes and page comments both use `m.thread` relations. A scene root
carries `com.vtt.scene_root: true`; while a scene is active, chat
sends thread under it.

## 5. Ordering and conflict

There is no version field and no last-write-wins guard. Yjs state
vectors give the causal ordering, and concurrent edits merge. A client
distinguishes normal lag (behind only) from a genuine fork (behind and
ahead) and recovers from a snapshot only on a fork.

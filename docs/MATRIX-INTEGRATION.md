# Matrix Integration Guide

MatrixVTT utilizes Matrix as its primary synchronization and persistence layer. 

## Matrix Protocol Architecture

Matrix operates as a decentralized, event-driven protocol providing:
- **Synchronization**: `/sync` endpoint for real-time event streaming.
- **Persistence**: Room state storage on homeservers.
- **Access Control**: Power levels for state mutability restrictions.
- **Conflict Resolution**: Operational transformation and eventual consistency across federated networks.

## Widget API Implementation

MatrixVTT operates within an iframe, communicating with the Matrix client via the `postMessage` protocol (Widget API).

### Lifecycle

1. **Initialization**: Widget establishes `postMessage` channel.
2. **Capability Negotiation**: Requests specific Matrix capabilities.
3. **Execution**: Bidirectional event propagation between Widget and Homeserver via Matrix Client.

### Required Capabilities

| Capability | Scope |
|------------|-------|
| `receive.state_event:com.vtt.*` | Read application state |
| `send.state_event:com.vtt.*` | Write application state |
| `receive.event:m.room.message` | Read timeline events |
| `send.event:m.room.message` | Write timeline events |
| `timeline:*` | Access historical events |

## Security Model

1. **Trust Boundary**: MatrixVTT utilizes unencrypted state events. Data confidentiality requires self-hosted, private homeservers.
2. **State Validation**: All event validation occurs client-side. Production environments require a server-side validation bot to mitigate malicious state injection.
3. **Power Levels**:
   - `0`: Default execution privilege.
   - `50`: Moderator execution privilege (Required for `com.vtt.map`, `com.vtt.npc`, `com.vtt.ui_mode`).
4. **Data Sanitization**: Implementation requires strict escaping of text content and HTML sanitization for rich text descriptions.
5. **Origin Controls**: Widgets require deployment over HTTPS with stable domains and client-side configuration allowlisting.

## State Management

### Event Typology

- **State Events (`com.vtt.[entity].[id]`)**: Persistent, queryable data (e.g., token positions, character sheets).
- **Timeline Events**: Ephemeral, chronological data (e.g., dice rolls, chat).

### Concurrency and Conflict Resolution

Matrix resolves state conflicts via lexicographical sorting of event IDs. The widget implements optimistic UI updates, reverting to server-authoritative state upon echo reception.

### Capacity Constraints

Matrix imposes a soft limit of 64KB per state event. Complex structures are segmented into discrete namespaces or offloaded to the Matrix media repository via `mxc://` URIs.

## Schema Versioning

Schemas employ additive versioning. Clients must implement graceful degradation for unrecognized fields and enforce default values for missing attributes.

## Performance Optimization

1. **Initial Load**: The `/sync` endpoint restricts data retrieval to current state, optimizing initialization time.
2. **Offline Caching**: Client-side state snapshots utilize `localStorage`.
3. **Throttling**: High-frequency operations (e.g., pointer drag events) require batching or debouncing to prevent server rate limiting.

## Error Recovery

The widget queue implementation buffers outbound state events during network discontinuities, automatically transmitting queued operations upon reconnection. Malformed incoming events are quarantined via schema validation.

## Deployment Architecture

Widgets require HTTPS deployment. Element clients require explicit whitelisting in `config.json`. The widget origin must implement strict Content Security Policies (`frame-ancestors`).

## Operational Semantics

### Join and Authentication

Standalone initialization flow (`src/standalone/session.js`):
1. Execute `/sync` to establish existing memberships.
2. For missing memberships, invoke `POST /_matrix/client/v3/join/{id}`.
3. Handle access rejection (`M_FORBIDDEN`) by initiating `/knock/{id}`.

### State Reclamation

Tombstoning executes by updating `com.vtt.*` events with empty content objects. Critical structural capacity limits necessitate full room upgrades via `POST /_matrix/client/v3/rooms/{id}/upgrade`, purging non-essential state objects. Entity creation (`src/utils/stable-id.js`) reuses existing tombstoned positional slots to cap total state volume.

### Rate Limit Coordination

Bulk operations integrate rate limit monitoring via `VTT_EVENTS.RATE_LIMITED`. Throttled operations yield to server-specified `retry_after_ms` parameters.

## External Data Structures

### Document Store (`com.vtt.page`)

Journal and lore documents utilize Yjs CRDTs serialized over Matrix. Operations fan out via `com.matrixvtt.yjs.update`.

### Chat and Threading

Outgoing chat utilizes the `org.matrix.custom.html` format. Threading leverages standard `m.thread` relationships, scoped explicitly to active narrative scenes to prevent cross-contamination.

### Content Library (`com.vtt.library`, `com.vtt.library_entry`)

Reusable content (rulesets, characters, NPCs, items, spells, maps) is stored in a **personal library room** separate from any campaign room. Standalone (app) mode only; widget mode hides the feature because the widget bridge is single-room scoped (`WidgetManager.getMatrixClient()` returns `null`).

- **`com.vtt.library`** (empty `state_key`): marks a joined room as the user's library. Content `{ vtt_version: 1 }`.
- **`com.vtt.library_entry`** (`state_key` = entry id): one entry, content `{ vtt_version, kind, name, updated_at, data }` where `kind` is one of `character | npc | item | spell | map | ruleset` and `data` is the cloned entity (for rulesets, `{ system, ...systemConfig }`). Deletion writes empty content (standard tombstone). Entries are hard-capped at 60KB (`LIBRARY_ENTRY_MAX_BYTES`) to stay under the 64KB state-event limit; only rulesets approach it.

Discovery (`src/library/discovery.js`) scans `getJoinedRooms()` for the marker and caches the room id in user-scoped `localStorage` (`vtt:library-room`), re-verifying the cache with a single marker probe before trusting it. The room is created lazily on the first library write, with the marker in `initial_state`. Campaign syncers ignore library-room events because `MatrixApiAdapter` filters incoming events by the active `roomId`.

**Limitation:** map `image_url` values are `mxc://` URIs scoped to the homeserver they were uploaded to. Inserting a library map into a campaign on a different homeserver stores the same URI, which that server cannot resolve; the image will not render. There is no cross-homeserver media re-upload.

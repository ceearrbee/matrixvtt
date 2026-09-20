/**
 * writer.js - barrel over the domain-split writer modules.
 *
 * Each writer module handles one cohesive concern; this barrel exists
 * because `StateManager` and a few callers already import from
 * `./writer.js`. New code should import the domain-specific file:
 *   - writers/world-writers.js    → fog, maps, walls, drawings
 *   - writers/entity-writers.js   → tokens + per-collection CRUD
 *   - writers/combat-writers.js   → initiative, damage, templates
 *   - writers/session-writers.js  → settings, active-map, foreign-tombstone
 *   - writers/asset-writers.js    → the room's uploaded-media library
 *   - writers/generated-walls.js  → walls derived from a generated layout
 */

export * from './writers/world-writers.js';
export * from './writers/entity-writers.js';
export * from './writers/combat-writers.js';
export * from './writers/session-writers.js';
export * from './writers/asset-writers.js';
export * from './writers/generated-walls.js';

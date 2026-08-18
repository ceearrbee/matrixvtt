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
 */

export * from './writers/world-writers.js';
export * from './writers/entity-writers.js';
export * from './writers/combat-writers.js';
export * from './writers/session-writers.js';

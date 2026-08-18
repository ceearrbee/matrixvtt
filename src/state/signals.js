/**
 * signals.js - the canonical reactive store for MatrixVTT state.
 *
 * StateManager wraps each entity collection in a `ReactiveMap` backed
 * by the matching signal here, and exposes each singleton (fog,
 * initiative, settings, …) as an accessor pair over the signal.
 * Mutations through the facade publish automatically; there is no
 * separate Map that has to be kept in lockstep.
 *
 * Preact components and `MapRenderer` subscribe by reading
 * `signal.value` during render / inside `effect()`.
 */

import { signal } from '@preact/signals';

export const tokensSignal = signal(new Map());
export const charactersSignal = signal(new Map());
export const npcsSignal = signal(new Map());
export const itemsSignal = signal(new Map());
export const spellsSignal = signal(new Map());
export const handoutsSignal = signal(new Map());
export const tablesSignal = signal(new Map());
export const pinsSignal = signal(new Map());
export const templatesSignal = signal(new Map());
export const wallsSignal = signal(new Map());
export const lightsSignal = signal(new Map());
export const mapsSignal = signal(new Map());
export const pagesSignal = signal(new Map());

export const fogSignal = signal(new Map());
export const initiativeSignal = signal({ active: false, round: 0, current_index: 0, order: [] });
export const settingsSignal = signal({});
export const activeMapIdSignal = signal(null);
export const drawingsSignal = signal([]);
export const roomMembersSignal = signal([]);
export const pendingKnocksSignal = signal([]);
export const reactionsSignal = signal(new Map());

/**
 * One-shot pending placement: when set to `{ kind: 'item-token', itemId }`,
 * the next map-stage click consumes the signal and spawns a token derived
 * from the referenced item at the click position. Cleared after the spawn
 * (or when the GM hits Escape / cancels).
 */
export const pendingPlacementSignal = signal(null);

/**
 * Pure wizard-vs-welcome decision for the first render.
 *
 * forceWizard is the explicit create-room intent and beats the
 * room-visited stamp: the stamp exists to suppress re-prompts on
 * reload, not to override a deliberate setup flow. Both paths still
 * defer to residual entities and a published server snapshot so a
 * populated room is never re-seeded.
 *
 * @param {{
 *   alreadyVisited: boolean,
 *   noMap: boolean,
 *   forceWizard: boolean,
 *   residual: number,
 *   snapshotState: 'present' | 'absent' | 'unknown',
 * }} args
 * @returns {{ showWizard: boolean, staleStamp: boolean }}
 */
export function decideFirstRender({ alreadyVisited, noMap, forceWizard, residual, snapshotState }) {
  const serverHasSnapshot = snapshotState === 'present';
  // Stale stamp: the user has "been here" but the room is positively
  // confirmed empty (probe succeeded and returned nothing). Only
  // 'absent' invalidates - 'unknown' (probe error) never does.
  const staleStamp = alreadyVisited && noMap && residual === 0 && snapshotState === 'absent';
  const effectiveVisited = alreadyVisited && !staleStamp;

  const showWizard = forceWizard
    ? residual === 0 && !serverHasSnapshot
    : !effectiveVisited && noMap && residual === 0 && !serverHasSnapshot;

  return { showWizard, staleStamp };
}

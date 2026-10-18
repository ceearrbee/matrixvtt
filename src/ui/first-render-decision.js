/**
 * Pure first-render decision. The setup wizard opens on its own only
 * for a room the user just created (forceWizard), and never over
 * entities or a published snapshot that are already there. Every
 * other room opens straight to its chat.
 *
 * @param {{
 *   forceWizard: boolean,
 *   residual: number,
 *   snapshotState: 'present' | 'absent' | 'unknown',
 * }} args
 * @returns {boolean}
 */
export function decideFirstRender({ forceWizard, residual, snapshotState }) {
  return forceWizard && residual === 0 && snapshotState !== 'present';
}

/**
 * The sheet tabs (Items, Spells, Skills) each rendered the bare
 * sentence "No character selected" with nothing to click, five times
 * over. The reader knows a character is missing; what they need is a
 * roster to pick from or a wizard to make one.
 */
import { h } from 'preact';
import { EmptyState } from './EmptyState.jsx';
import { TABS } from '../utils/constants.js';

export function NoCharacterSelected({ ui }) {
  const roster = ui?.switchTab ? { label: 'Open the party roster', onClick: () => ui.switchTab(TABS.PARTY) } : null;
  const make = ui?.showCharacterWizard ? { label: 'Make a character', onClick: () => ui.showCharacterWizard() } : null;
  return h(EmptyState, {
    title: 'No character selected',
    body: 'Pick a character from the party roster, or make one to start filling this tab.',
    cta: roster ?? make,
    secondary: roster ? make : null,
  });
}

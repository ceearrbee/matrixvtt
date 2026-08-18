/**
 * CharacterSwitcher - player-only dropdown to swap between owned PCs.
 * Hidden for GMs; hidden when the player owns fewer than two
 * characters. Preact text children auto-escape the option labels.
 */
import { h } from 'preact';
import { charactersSignal } from '../state/signals.js';

export function CharacterSwitcher({ ui }) {
  // Subscribe to character changes so the dropdown re-renders when a
  // claim or new character lands while the player is in-session.
  charactersSignal.value;
  if (ui.state.isGM()) return null;
  const myUserId = ui.widgetManager?.userId;
  const mine = Array.from(ui.state.characters.entries())
    .filter(([, c]) => c.player_user_id === myUserId || c.claimed_by_user_id === myUserId);
  if (mine.length < 2) return null;
  const currentId = ui.state.getCurrentCharacterId();

  return h('div', { class: 'char-switcher' }, [
    h('label', { for: 'char-switcher-select', class: 'sr-only' }, 'Active character'),
    h('select', {
      id: 'char-switcher-select',
      class: 'char-switcher__select',
      'aria-label': 'Switch active character',
      value: currentId ?? '',
      onChange: (e) => ui.selectCharacterById(e.target.value),
    }, mine.map(([id, c]) => h('option', { value: id, key: id }, c.name))),
  ]);
}

/**
 * CharacterSwitcher Preact component - replaces the legacy
 * `renderCharacterSwitcher` TrustedMarkup feed. Asserts:
 *   - Hidden for GMs.
 *   - Hidden when the player owns <2 characters.
 *   - Owner-only characters listed; change triggers selectCharacterById.
 *   - XSS-shaped names are structurally escaped (Preact text children).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, h } from 'preact';
import { CharacterSwitcher } from '../ui/CharacterSwitcher.jsx';

function mkUi({ isGM = false, userId = '@me:s', characters = [], currentId = null, onSelect = vi.fn() } = {}) {
  return {
    state: {
      isGM: () => isGM,
      characters: new Map(characters),
      getCurrentCharacterId: () => currentId,
    },
    widgetManager: { userId },
    selectCharacterById: onSelect,
  };
}

function mount(ui) {
  const host = document.createElement('div');
  render(h(CharacterSwitcher, { ui }), host);
  return host;
}

describe('<CharacterSwitcher>', () => {
  it('renders nothing for GM', () => {
    const host = mount(mkUi({ isGM: true }));
    expect(host.innerHTML).toBe('');
  });

  it('renders nothing when player owns fewer than 2 characters', () => {
    const host = mount(mkUi({ characters: [['c-a', { name: 'Solo', player_user_id: '@me:s' }]] }));
    expect(host.innerHTML).toBe('');
  });

  it('renders a <select> with one <option> per owned character', () => {
    const host = mount(mkUi({
      characters: [
        ['c-a', { name: 'Aria', player_user_id: '@me:s' }],
        ['c-b', { name: 'Bran', player_user_id: '@me:s' }],
      ],
      currentId: 'c-a',
    }));
    const sel = host.querySelector('#char-switcher-select');
    expect(sel).toBeTruthy();
    expect(sel.querySelectorAll('option')).toHaveLength(2);
    expect(sel.value).toBe('c-a');
  });

  it('fires selectCharacterById on change', () => {
    const onSelect = vi.fn();
    const host = mount(mkUi({
      characters: [
        ['c-a', { name: 'Aria', player_user_id: '@me:s' }],
        ['c-b', { name: 'Bran', player_user_id: '@me:s' }],
      ],
      currentId: 'c-a',
      onSelect,
    }));
    const sel = host.querySelector('#char-switcher-select');
    sel.value = 'c-b';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('c-b');
  });

  it('escapes XSS-shaped character names structurally (Preact text children)', () => {
    const host = mount(mkUi({
      characters: [
        ['c-a', { name: '<script>alert(1)</script>', player_user_id: '@me:s' }],
        ['c-b', { name: 'B"onerror="x', player_user_id: '@me:s' }],
      ],
      currentId: 'c-a',
    }));
    expect(host.querySelector('script')).toBeNull();
    expect(host.innerHTML).not.toContain('<script>alert');
    expect(host.innerHTML).toContain('&lt;script&gt;');
  });
});

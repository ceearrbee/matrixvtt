/**
 * Player first-run welcome overlay - showPlayerWelcome
 *
 * When a non-GM player joins a session for the first time (no claimed character)
 * show a brief overlay explaining how to claim a character.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showPlayerWelcome } from '../ui/first-time-setup.js';

function makeUi({ isGM = false, hasClaimed = false, charCount = 2 }) {
  const characters = new Map();
  const userId = '@player:example.com';
  for (let i = 0; i < charCount; i++) {
    characters.set(`char-${i}`, {
      name: `Hero ${i}`,
      claimed_by_user_id: hasClaimed && i === 0 ? userId : null,
    });
  }
  return {
    state: {
      isGM: () => isGM,
      widgetManager: { userId },
      characters,
    },
    _toast: vi.fn(),
  };
}

describe('showPlayerWelcome', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows welcome overlay for a player without a claimed character', () => {
    const ui = makeUi({ isGM: false, hasClaimed: false });
    showPlayerWelcome(ui);
    // Modal is rendered into a dynamic host div; check for the specific header text.
    expect(document.body.textContent).toContain('Welcome to the Session');
  });

  it('does NOT show overlay when the player already has a claimed character', () => {
    const ui = makeUi({ isGM: false, hasClaimed: true });
    showPlayerWelcome(ui);
    expect(document.body.textContent).not.toContain('Welcome to the Session');
  });

  it('does NOT show overlay for GMs', () => {
    const ui = makeUi({ isGM: true, hasClaimed: false });
    showPlayerWelcome(ui);
    expect(document.body.textContent).not.toContain('Welcome to the Session');
  });

  it('overlay contains a dismiss button', () => {
    const ui = makeUi({ isGM: false, hasClaimed: false });
    showPlayerWelcome(ui);
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent === 'Got it');
    expect(btn).not.toBeNull();
  });

  it('with zero characters, does not promise a claimable character', () => {
    const ui = makeUi({ isGM: false, hasClaimed: false, charCount: 0 });
    showPlayerWelcome(ui);
    expect(document.body.textContent).toContain('Welcome to the Session');
    expect(document.body.textContent).not.toMatch(/claim/i);
    expect(document.body.textContent).toMatch(/no characters .*yet/i);
  });

  it('overlay mentions claiming a character', () => {
    const ui = makeUi({ isGM: false, hasClaimed: false });
    showPlayerWelcome(ui);
    expect(document.body.textContent.toLowerCase()).toMatch(/claim/);
  });
});

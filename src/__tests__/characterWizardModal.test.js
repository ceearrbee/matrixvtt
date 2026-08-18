/**
 * The wizard is a legacy string-template modal. Its surface must use
 * the same classes Modal.jsx uses (.modal-overlay > .modal-content);
 * styles.css defines no other modal surface class, so anything else
 * renders transparent over the map.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { showCharacterWizard } from '../ui/character-wizard.js';

function makeUi() {
  return /** @type {any} */ ({
    state: { settings: { system: 'dnd5e' } },
  });
}

describe('showCharacterWizard modal surface', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the styled .modal-content surface inside the overlay', () => {
    showCharacterWizard(makeUi());
    const overlay = document.getElementById('char-wizard-modal');
    expect(overlay).toBeTruthy();
    expect(overlay.classList.contains('modal-overlay')).toBe(true);
    expect(overlay.querySelector('.modal-content')).toBeTruthy();
    expect(overlay.querySelector(':scope > .modal')).toBeFalsy();
  });
});

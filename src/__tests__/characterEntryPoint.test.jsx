/**
 * One primary way to make a character, and it is the guided one.
 *
 * Every other surface that offers the job - the next-steps chip, the
 * command palette, the "no character selected" placeholder - routes to
 * the wizard. The empty roster was the exception: it led with the blank
 * form and offered the wizard as an afterthought, so the one place a
 * newcomer actually lands was the one place that handed them a full
 * sheet with no guidance, beside a second button with no basis to
 * choose between them.
 *
 * The blank sheet stays, quietly, for people who already know the
 * system and do not want to be walked through it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, h } from 'preact';
import { EntityList } from '../ui/EntityList.jsx';
import { ENTITY_TYPES } from '../utils/constants.js';
import { charactersSignal } from '../state/signals.js';

function mkUi() {
  charactersSignal.value = new Map();
  return /** @type {any} */ ({
    state: { isGM: () => false, characters: new Map(), npcs: new Map() },
    showEntityForm: vi.fn(),
    showCharacterWizard: vi.fn(),
  });
}

function mountEmpty(ui) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(h(EntityList, { ui, type: ENTITY_TYPES.PC }), host);
  return host;
}

describe('the empty roster leads with the wizard', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('makes the guided wizard the primary action', () => {
    const host = mountEmpty(mkUi());
    const primary = host.querySelector('.btn-primary');
    expect(primary.getAttribute('data-character-wizard')).not.toBeNull();
  });

  it('opens the wizard, not the blank form, from the primary button', () => {
    const ui = mkUi();
    const host = mountEmpty(ui);
    host.querySelector('[data-character-wizard]').click();
    expect(ui.showCharacterWizard).toHaveBeenCalled();
    expect(ui.showEntityForm).not.toHaveBeenCalled();
  });

  it('keeps the blank sheet as a secondary, non-primary way through', () => {
    const ui = mkUi();
    const host = mountEmpty(ui);
    const blank = host.querySelector('[data-create-character]');
    expect(blank.className).not.toMatch(/btn-primary/);
    blank.click();
    expect(ui.showEntityForm).toHaveBeenCalledWith(ENTITY_TYPES.PC);
  });

  it('names both buttons in words, with no emoji', () => {
    const host = mountEmpty(mkUi());
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(label, `emoji in "${label}"`).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(label.trim().length).toBeGreaterThan(3);
    }
  });
});

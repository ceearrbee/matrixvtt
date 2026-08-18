/**
 * Handout editing - showHandoutForm with an existing ID
 *
 * When showHandoutForm(ui, id) is called with an existing handout ID
 * the modal must pre-populate fields with existing data, the submit
 * button must say "Save", and saving must update the existing handout
 * (not create a new one with a different key).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showHandoutForm } from '../ui/handouts-panel.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { withFacade } from './helpers/withFacade.js';

function makeUi(handouts = {}) {
  const state = withFacade({
    isGM: () => true,
    handouts: new Map(Object.entries(handouts)),
    sendStateEvent: vi.fn().mockResolvedValue({}),
  });
  return {
    state,
    _toast: vi.fn(),
    renderHandoutsTab: vi.fn().mockReturnValue('<div></div>'),
  };
}

describe('showHandoutForm - edit mode', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Provide a #tab-notes target so the handler can update the tab
    const tab = document.createElement('div');
    tab.id = 'tab-notes';
    document.body.appendChild(tab);
  });

  it('opens a modal with title "Edit Handout" when an id is provided', () => {
    const ui = makeUi({ 'ho-1': { title: 'Old Title', content: 'Old content', image_url: null, visible_to_players: false } });
    showHandoutForm(ui, 'ho-1');
    const modal = document.querySelector('[id*="handout-form-modal"]');
    expect(modal?.textContent).toMatch(/edit handout/i);
  });

  it('pre-populates title and content from the existing handout', () => {
    const ui = makeUi({ 'ho-1': { title: 'My Note', content: 'Some text', image_url: null, visible_to_players: false } });
    showHandoutForm(ui, 'ho-1');
    const title = /** @type {HTMLInputElement} */ (document.getElementById('handout-title'));
    const content = /** @type {HTMLTextAreaElement} */ (document.getElementById('handout-content'));
    expect(title?.value).toBe('My Note');
    expect(content?.value).toBe('Some text');
  });

  it('submit button reads "Save" in edit mode', () => {
    const ui = makeUi({ 'ho-1': { title: 'T', content: '', image_url: null, visible_to_players: false } });
    showHandoutForm(ui, 'ho-1');
    const btn = document.getElementById('handout-submit');
    expect(btn?.textContent?.trim()).toBe('Save');
  });

  it('saving updates the existing handout key (not a new one)', async () => {
    const ui = makeUi({ 'ho-1': { title: 'Old', content: '', image_url: null, visible_to_players: false } });
    showHandoutForm(ui, 'ho-1');

    // Change the title
    const titleEl = /** @type {HTMLInputElement} */ (document.getElementById('handout-title'));
    titleEl.value = 'Updated Title';

    document.getElementById('handout-submit')?.click();
    await new Promise(r => setTimeout(r, 0));

    // The SAME key 'ho-1' must be used, not a new timestamp key
    expect(ui.state.sendStateEvent).toHaveBeenCalledWith(EVENT_TYPES.HANDOUT, 'ho-1', expect.objectContaining({ title: 'Updated Title' }));
    expect(ui.state.handouts.has('ho-1')).toBe(true);
    expect(ui.state.handouts.get('ho-1').title).toBe('Updated Title');
  });

  it('create mode still uses a generated id and says "Create"', () => {
    const ui = makeUi();
    showHandoutForm(ui); // no id
    const btn = document.getElementById('handout-submit');
    expect(btn?.textContent?.trim()).toBe('Create');
  });
});

/**
 * The help modal derived its heading from the registry key, so a user
 * who clicked the ⓘ beside a control labelled "tone" was shown a
 * dialog headed "About: Persona", and the pill labelled OOC opened
 * "About: Msgtype". Identifiers must not leak into copy: every term
 * carries its own title, and the term sits on the control that uses
 * the word.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import fs from 'node:fs';
import path from 'node:path';
import { HelpIcon } from '../ui/HelpIcon.jsx';
import { HELP_TERMS } from '../ui/help-terms.js';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('help term titles', () => {
  afterEach(() => { cleanup(); document.body.innerHTML = ''; });

  it('every term declares its own title, in the words the UI uses', () => {
    for (const [term, entry] of Object.entries(HELP_TERMS)) {
      expect(entry.title, `${term} has no title`).toBeTruthy();
      expect(entry.title, `${term} title is the raw key`).not.toBe(term);
    }
  });

  it('renders the declared title, not the registry key', () => {
    const { container } = render(h(HelpIcon, { term: 'msgtype' }));
    fireEvent.click(container.querySelector('button'));
    const heading = document.querySelector('#help-modal-msgtype-title');
    expect(heading.textContent).toBe(HELP_TERMS.msgtype.title);
    expect(heading.textContent).not.toMatch(/msgtype/i);
  });

  it('derives no title from the key at all', () => {
    expect(read('src/ui/HelpIcon.jsx')).not.toMatch(/charAt\(0\)\.toUpperCase/);
  });

  it('puts the tone term on the tone picker and persona on the speak-as chip', () => {
    expect(HELP_TERMS).toHaveProperty('tone');
    expect(read('src/ui/ChatTonePicker.jsx')).toMatch(/term: 'tone'/);
    expect(read('src/ui/DiceBar.jsx')).toMatch(/term: 'persona'/);
  });
});

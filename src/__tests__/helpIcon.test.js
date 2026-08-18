/**
 * HelpIcon: small "ⓘ" button that surfaces a one-sentence definition via
 * the title attribute and a long-form ModalFactory modal on click. Term
 * copy lives in src/ui/help-terms.js so it stays out of UI files.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { h, render } from 'preact';
import { HelpIcon } from '../ui/HelpIcon.jsx';
import { HELP_TERMS } from '../ui/help-terms.js';

function mount(node) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(node, host);
  return host;
}

describe('help-terms registry', () => {
  it('declares short and long copy for ruleset/fog/initiative', () => {
    for (const key of ['ruleset', 'fog', 'initiative']) {
      expect(HELP_TERMS[key]).toBeTruthy();
      expect(typeof HELP_TERMS[key].short).toBe('string');
      expect(HELP_TERMS[key].short.length).toBeGreaterThan(10);
      expect(typeof HELP_TERMS[key].long).toBe('string');
      expect(HELP_TERMS[key].long.length).toBeGreaterThan(20);
    }
  });
});

describe('HelpIcon', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders a button with title and aria-label tied to the term', () => {
    const host = mount(h(HelpIcon, { term: 'ruleset' }));
    const btn = host.querySelector('button.help-icon');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Help: ruleset');
    expect(btn.getAttribute('title')).toBe(HELP_TERMS.ruleset.short);
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.textContent).toMatch(/[ⓘ?]/);
  });

  it('opens an info modal containing the long-form copy on click', () => {
    const host = mount(h(HelpIcon, { term: 'fog' }));
    const btn = host.querySelector('button.help-icon');
    btn.click();
    const modal = document.querySelector('.modal-overlay');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain(HELP_TERMS.fog.long);
  });

  it('renders nothing for unknown terms instead of throwing', () => {
    const host = mount(h(HelpIcon, { term: 'nonexistent-term' }));
    expect(host.querySelector('button.help-icon')).toBe(null);
  });

  it('accepts a custom aria-label override', () => {
    const host = mount(h(HelpIcon, { term: 'ruleset', label: 'What is a ruleset?' }));
    const btn = host.querySelector('button.help-icon');
    expect(btn.getAttribute('aria-label')).toBe('What is a ruleset?');
  });
});

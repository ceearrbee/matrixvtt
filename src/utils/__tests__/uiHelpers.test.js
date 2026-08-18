/**
 * ui-helpers.js - unit tests (Pass 16)
 *
 * Covers getHPPercentage, getHPColor, FormReader (getField / getInt /
 * getCheckbox / getSelect), and trapFocusIn.
 * ModalFactory is excluded - it depends on document.body + setTimeout
 * in ways that belong in an integration-level test.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getHPPercentage,
  getHPColor,
  FormReader,
  trapFocusIn
} from '../ui-helpers.js';

// ─── getHPPercentage ──────────────────────────────────────────────────────────

describe('getHPPercentage', () => {
  it('returns 0 for null entity', () => {
    expect(getHPPercentage(null)).toBe(0);
  });

  it('returns 0 when hp_max is 0', () => {
    expect(getHPPercentage({ hp_current: 10, hp_max: 0 })).toBe(0);
  });

  it('returns 0 when hp_max is negative', () => {
    expect(getHPPercentage({ hp_current: 10, hp_max: -5 })).toBe(0);
  });

  it('returns 100 when at full health', () => {
    expect(getHPPercentage({ hp_current: 30, hp_max: 30 })).toBe(100);
  });

  it('returns 50 at half health', () => {
    expect(getHPPercentage({ hp_current: 15, hp_max: 30 })).toBe(50);
  });

  it('clamps to 0 when hp_current is negative', () => {
    expect(getHPPercentage({ hp_current: -5, hp_max: 30 })).toBe(0);
  });

  it('clamps to 100 when hp_current exceeds hp_max (overhealed)', () => {
    expect(getHPPercentage({ hp_current: 40, hp_max: 30 })).toBe(100);
  });

  it('defaults hp_current to 0 when field is undefined', () => {
    expect(getHPPercentage({ hp_max: 20 })).toBe(0);
  });
});

// ─── getHPColor ───────────────────────────────────────────────────────────────

describe('getHPColor', () => {
  it('returns success color at 100%', () => {
    expect(getHPColor(100)).toBe('var(--color-text-success)');
  });

  it('returns success color at exactly 75%', () => {
    expect(getHPColor(75)).toBe('var(--color-text-success)');
  });

  it('returns warning color at 74%', () => {
    expect(getHPColor(74)).toBe('var(--color-text-warning)');
  });

  it('returns warning color at exactly 40%', () => {
    expect(getHPColor(40)).toBe('var(--color-text-warning)');
  });

  it('returns danger color at 39%', () => {
    expect(getHPColor(39)).toBe('var(--color-text-danger)');
  });

  it('returns danger color at 0%', () => {
    expect(getHPColor(0)).toBe('var(--color-text-danger)');
  });
});

// ─── FormReader.getField ──────────────────────────────────────────────────────

describe('FormReader.getField', () => {
  function makeEl(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  it('returns value of the matching field', () => {
    const el = makeEl('<input id="char-name" value="Aria">');
    expect(new FormReader(el).getField('char-name')).toBe('Aria');
  });

  it('falls through to the second ID when first is absent', () => {
    const el = makeEl('<input id="name-legacy" value="Bard">');
    expect(new FormReader(el).getField('char-name', 'name-legacy')).toBe('Bard');
  });

  it('returns empty string when no ID matches', () => {
    const el = makeEl('');
    expect(new FormReader(el).getField('nonexistent')).toBe('');
  });

  it('returns empty string when field exists but value is empty', () => {
    const el = makeEl('<input id="desc" value="">');
    expect(new FormReader(el).getField('desc')).toBe('');
  });
});

// ─── FormReader.getInt ────────────────────────────────────────────────────────

describe('FormReader.getInt', () => {
  function makeEl(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  it('parses integer value from field', () => {
    const el = makeEl('<input id="hp" value="42">');
    expect(new FormReader(el).getInt('hp')).toBe(42);
  });

  it('returns 0 when field is empty', () => {
    const el = makeEl('<input id="hp" value="">');
    expect(new FormReader(el).getInt('hp')).toBe(0);
  });

  it('returns 0 when field contains non-numeric text', () => {
    const el = makeEl('<input id="hp" value="abc">');
    expect(new FormReader(el).getInt('hp')).toBe(0);
  });

  it('truncates floats to integer', () => {
    const el = makeEl('<input id="hp" value="3.9">');
    expect(new FormReader(el).getInt('hp')).toBe(3);
  });
});

// ─── FormReader.getCheckbox ───────────────────────────────────────────────────

describe('FormReader.getCheckbox', () => {
  function makeEl(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  it('returns true when checkbox is checked', () => {
    const el = makeEl('<input type="checkbox" id="visible" checked>');
    expect(new FormReader(el).getCheckbox('visible')).toBe(true);
  });

  it('returns false when checkbox is unchecked', () => {
    const el = makeEl('<input type="checkbox" id="visible">');
    expect(new FormReader(el).getCheckbox('visible')).toBe(false);
  });

  it('returns false when no matching ID exists', () => {
    const el = makeEl('');
    expect(new FormReader(el).getCheckbox('missing')).toBe(false);
  });
});

// ─── FormReader.getSelect ─────────────────────────────────────────────────────

describe('FormReader.getSelect', () => {
  function makeEl(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  it('returns the selected option value', () => {
    const el = makeEl(`
      <select id="type">
        <option value="pc">PC</option>
        <option value="npc" selected>NPC</option>
      </select>
    `);
    expect(new FormReader(el).getSelect('type')).toBe('npc');
  });

  it('returns empty string when select element is absent', () => {
    const el = makeEl('');
    expect(new FormReader(el).getSelect('missing')).toBe('');
  });
});

// ─── trapFocusIn ─────────────────────────────────────────────────────────────

describe('trapFocusIn', () => {
  it('returns a cleanup function', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button>A</button><button>B</button>';
    document.body.appendChild(el);
    const cleanup = trapFocusIn(el);
    expect(typeof cleanup).toBe('function');
    cleanup();
    el.remove();
  });

  it('wraps Tab from last focusable element to first', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button>First</button><button>Last</button>';
    document.body.appendChild(el);
    const buttons = el.querySelectorAll('button');
    buttons[1].focus();

    let prevented = false;
    const cleanup = trapFocusIn(el);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(tab, 'preventDefault', { value: () => { prevented = true; } });
    el.dispatchEvent(tab);

    expect(prevented).toBe(true);
    cleanup();
    el.remove();
  });

  it('wraps Shift+Tab from first focusable element to last', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button>First</button><button>Last</button>';
    document.body.appendChild(el);
    const buttons = el.querySelectorAll('button');
    buttons[0].focus();

    let prevented = false;
    const cleanup = trapFocusIn(el);
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    Object.defineProperty(shiftTab, 'preventDefault', { value: () => { prevented = true; } });
    el.dispatchEvent(shiftTab);

    expect(prevented).toBe(true);
    cleanup();
    el.remove();
  });

  it('cleanup removes the keydown listener', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button>First</button><button>Last</button>';
    document.body.appendChild(el);
    const buttons = el.querySelectorAll('button');
    buttons[1].focus();

    const cleanup = trapFocusIn(el);
    cleanup();

    let prevented = false;
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(tab, 'preventDefault', { value: () => { prevented = true; } });
    el.dispatchEvent(tab);

    expect(prevented).toBe(false);
    el.remove();
  });
});

describe('getHPColor - boundary values', () => {
  it('getHPColor(NaN) returns danger (NaN >= 75 and NaN >= 40 are both false)', () => {
    expect(getHPColor(NaN)).toBe('var(--color-text-danger)');
  });

  it('getHPColor(101) returns success (above 75 threshold)', () => {
    expect(getHPColor(101)).toBe('var(--color-text-success)');
  });
});

describe('FormReader.getInt - boundary values', () => {
  function makeEl(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  it('getInt with "0" returns 0, not a falsy default', () => {
    const el = makeEl('<input id="count" value="0">');
    expect(new FormReader(el).getInt('count')).toBe(0);
  });

  it('getInt with "" (empty string) returns 0', () => {
    const el = makeEl('<input id="count" value="">');
    expect(new FormReader(el).getInt('count')).toBe(0);
  });

  it('getInt with "1.9" returns 1 (parseInt truncates decimals)', () => {
    const el = makeEl('<input id="count" value="1.9">');
    expect(new FormReader(el).getInt('count')).toBe(1);
  });
});

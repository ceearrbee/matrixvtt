import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as modalFocus from '../ui/modal-focus.js';
import { FloatingPopup } from '../ui/popups/FloatingPopup.jsx';
import { showCommandPalette } from '../ui/command-palette.js';
import { PartyRoster } from '../ui/PartyRoster.jsx';
import { LeftIndex } from '../ui/LeftIndex.jsx';

function parseTokens(cssContent) {
  const tokens = {};
  for (const [, name, value] of cssContent.matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!(name in tokens)) tokens[name] = value.trim();
  }
  return tokens;
}

function parseColor(value) {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const hex3 = value.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [r, g, b] = hex3[1].split('').map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  const inner = value.match(/^rgba?\(([^)]*)\)$/);
  if (inner) {
    const parts = inner[1].split(',').map((p) => Number(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
    }
  }
  return null;
}

function compositeOver(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  const mix = (f, b) => (f * fg.a + b * bg.a * (1 - fg.a)) / (a || 1);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
}

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe('Accessibility Audit Fixes (Tasks 8, 9, 10)', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Task 8: FloatingPopup pinned focus trap & command-palette ARIA', () => {
    it('FloatingPopup traps focus when open and not pinned, but releases/does not trap when pinned', () => {
      const releaseTrap = vi.fn();
      const trapSpy = vi.spyOn(modalFocus, 'trapFocusIn').mockReturnValue(releaseTrap);

      // Render pinned=true
      const { rerender } = render(h(FloatingPopup, {
        open: true,
        name: 'test-pinned',
        title: 'Test Pinned',
        pinned: true,
        onClose: () => {},
      }, h('button', null, 'Click me')));

      expect(trapSpy).not.toHaveBeenCalled();

      // Rerender pinned=false -> activates trap
      rerender(h(FloatingPopup, {
        open: true,
        name: 'test-pinned',
        title: 'Test Pinned',
        pinned: false,
        onClose: () => {},
      }, h('button', null, 'Click me')));

      expect(trapSpy).toHaveBeenCalledTimes(1);
      expect(releaseTrap).not.toHaveBeenCalled();

      // Pin again -> releases trap
      rerender(h(FloatingPopup, {
        open: true,
        name: 'test-pinned',
        title: 'Test Pinned',
        pinned: true,
        onClose: () => {},
      }, h('button', null, 'Click me')));

      expect(releaseTrap).toHaveBeenCalledTimes(1);
    });

    it('command-palette sets role="combobox", aria-expanded="true", aria-controls, and updates aria-activedescendant', () => {
      const ui = {
        state: {
          tokens: new Map([['t1', { id: 't1', name: 'Goblin' }]]),
          characters: new Map([['c1', { id: 'c1', name: 'Hero' }]]),
          npcs: new Map(),
          items: new Map(),
          spells: new Map(),
          handouts: new Map(),
          pins: new Map(),
        },
        mapRenderer: { panToToken: vi.fn(), setSelectedToken: vi.fn(), panTo: vi.fn() },
        previewToken: vi.fn(),
        selectCharacterById: vi.fn(),
        selectNPCById: vi.fn(),
        _toast: vi.fn(),
      };

      showCommandPalette(ui);
      const input = document.getElementById('cp-input');
      expect(input).not.toBeNull();
      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-expanded')).toBe('true');
      expect(input.getAttribute('aria-controls')).toBe('cp-results');
      expect(input.getAttribute('aria-activedescendant')).toBe('cp-opt-0');

      const listbox = document.getElementById('cp-results');
      expect(listbox).not.toBeNull();
      expect(listbox.getAttribute('role')).toBe('listbox');

      const rows = document.querySelectorAll('.cp-row');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].id).toBe('cp-opt-0');
      if (rows[1]) {
        expect(rows[1].id).toBe('cp-opt-1');
      }

      // ArrowDown updates aria-activedescendant
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input.getAttribute('aria-activedescendant')).toBe('cp-opt-1');
    });
  });

  describe('Task 9: app.html skip link & focus ring, PartyRoster & LeftIndex landmarks', () => {
    it('app.html skip-nav points to standalone anchor and auth-card input:focus has focus ring', () => {
      const html = readFileSync(resolve(process.cwd(), 'app.html'), 'utf8');
      expect(html).toContain('href="#vtt-root-anchor"');
      expect(html).toContain('id="vtt-root-anchor"');

      const authInputFocusMatch = html.match(/\.auth-card input:focus\s*\{([^}]+)\}/);
      expect(authInputFocusMatch).not.toBeNull();
      const ruleBody = authInputFocusMatch[1];
      expect(ruleBody).not.toContain('outline: none');
      expect(ruleBody).toContain('outline: 2px solid var(--color-focus)');
      expect(ruleBody).toContain('outline-offset: 2px');
    });

    it('PartyRoster renders section landmark without complementary role', () => {
      const ui = {
        widgetManager: { userId: '@user:test' },
        state: {
          characters: new Map([['c1', { id: 'c1', name: 'Aria', hp_current: 10, hp_max: 20 }]]),
          npcs: new Map(),
          tokens: new Map(),
          settings: { systemConfig: {} },
        },
      };

      const { container } = render(h(PartyRoster, { ui }));
      const roster = container.querySelector('.party-roster');
      expect(roster).not.toBeNull();
      expect(roster.tagName.toLowerCase()).toBe('section');
      expect(roster.getAttribute('aria-label')).toBe('Party roster');
      expect(roster.getAttribute('role')).toBeNull();
    });

    it('PartyRoster empty state renders section landmark without complementary role', () => {
      const ui = {
        widgetManager: { userId: '@user:test' },
        state: {
          characters: new Map(),
          npcs: new Map(),
          tokens: new Map(),
          settings: { systemConfig: {} },
        },
      };

      const { container } = render(h(PartyRoster, { ui }));
      const roster = container.querySelector('.party-roster');
      expect(roster).not.toBeNull();
      expect(roster.tagName.toLowerCase()).toBe('section');
      expect(roster.getAttribute('aria-label')).toBe('Party roster');
      expect(roster.getAttribute('role')).toBeNull();
    });

    it('LeftIndex renders nav landmark with aria-label="Index"', () => {
      const ui = {
        widgetManager: { userId: '@user:test' },
        state: {
          isGM: () => false,
          scenes: new Map(),
          pages: new Map(),
        },
      };

      const { container } = render(h(LeftIndex, { ui }));
      const index = container.querySelector('.left-index');
      expect(index).not.toBeNull();
      expect(index.tagName.toLowerCase()).toBe('nav');
      expect(index.getAttribute('aria-label')).toBe('Index');
      expect(index.getAttribute('role')).toBeNull();
    });
  });

  describe('Task 10: theme contrast tokens in dark.css and light.css', () => {
    it('dark.css --color-text-secondary and --color-text-tertiary achieve >= 4.5:1 contrast over background primary, secondary, and tertiary', () => {
      const darkCss = readFileSync(resolve(process.cwd(), 'src/themes/dark.css'), 'utf8');
      const tokens = parseTokens(darkCss);

      expect(tokens['--color-text-secondary']).toBe('rgba(226, 232, 245, 0.88)');
      expect(tokens['--color-text-tertiary']).toBe('rgba(215, 223, 240, 0.78)');

      const textSec = parseColor(tokens['--color-text-secondary']);
      const textTer = parseColor(tokens['--color-text-tertiary']);

      // Surfaces to test: actual token backgrounds and reference colors (#171b22, #1e232d, #2d3444)
      const surfaces = [
        parseColor(tokens['--color-background-primary']),
        parseColor(tokens['--color-background-secondary']),
        parseColor(tokens['--color-background-tertiary']),
        parseColor('#171b22'),
        parseColor('#1e232d'),
        parseColor('#2d3444'),
      ];

      for (const surface of surfaces) {
        const secRatio = ratio(compositeOver(textSec, surface), surface);
        const terRatio = ratio(compositeOver(textTer, surface), surface);
        expect(secRatio).toBeGreaterThanOrEqual(4.5);
        expect(terRatio).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('light.css --color-text-secondary and --color-text-tertiary achieve >= 4.5:1 contrast over background primary, secondary, and tertiary', () => {
      const lightCss = readFileSync(resolve(process.cwd(), 'src/themes/light.css'), 'utf8');
      const tokens = parseTokens(lightCss);

      expect(tokens['--color-text-secondary']).toBe('rgba(0, 0, 0, 0.76)');
      expect(tokens['--color-text-tertiary']).toBe('rgba(0, 0, 0, 0.68)');

      const textSec = parseColor(tokens['--color-text-secondary']);
      const textTer = parseColor(tokens['--color-text-tertiary']);

      // Surfaces to test: actual token backgrounds and reference colors (#f9fafb, #f1f3f6, #e8ecf1)
      const surfaces = [
        parseColor(tokens['--color-background-primary']),
        parseColor(tokens['--color-background-secondary']),
        parseColor(tokens['--color-background-tertiary']),
        parseColor('#f9fafb'),
        parseColor('#f1f3f6'),
        parseColor('#e8ecf1'),
      ];

      for (const surface of surfaces) {
        const secRatio = ratio(compositeOver(textSec, surface), surface);
        const terRatio = ratio(compositeOver(textTer, surface), surface);
        expect(secRatio).toBeGreaterThanOrEqual(4.5);
        expect(terRatio).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

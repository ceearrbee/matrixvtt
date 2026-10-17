/**
 * The left rail was two components mounted at once inside
 * `.shell__channels` - an always-expanded accordion and a slim
 * one-drawer icon rail - both importing the same bodies from
 * index-sections and switched by CSS. Everything rendered twice; the
 * control count counted both. One mount, one responsive variant.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render as prender, h } from 'preact';
import fs from 'node:fs';
import path from 'node:path';
import { LeftIndex } from '../ui/LeftIndex.jsx';
import { layoutModeSignal, openIconRailDrawerSignal } from '../state/ui-signals.js';
import { LAYOUT_MODES } from '../utils/constants.js';

function makeUi() {
  return /** @type {any} */ ({
    state: {
      isGM: () => true, tokens: new Map(), maps: new Map(), handouts: new Map(),
      pages: new Map(), settings: { name: 'r', systemConfig: {} },
    },
    widgetManager: { userId: '@me:m', roomId: '!r:m' },
  });
}

describe('one left rail', () => {
  let host;
  beforeEach(() => {
    localStorage.clear();
    layoutModeSignal.value = LAYOUT_MODES.TEXT;
    openIconRailDrawerSignal.value = null;
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => { prender(null, host); host.remove(); vi.restoreAllMocks(); });

  it('App mounts the rail exactly once', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/ui/App.jsx'), 'utf8');
    expect(src).not.toMatch(/from '\.\/IconRail\.jsx'/);
    expect(src.match(/h\(LeftIndex/g)).toHaveLength(1);
  });

  it('renders the accordion in text layout', () => {
    prender(h(LeftIndex, { ui: makeUi() }), host);
    expect(host.querySelector('.left-index')).not.toBeNull();
    expect(host.querySelector('.icon-rail')).toBeNull();
  });

  it('renders the compact rail in icon layout, and only that', () => {
    layoutModeSignal.value = LAYOUT_MODES.ICON;
    prender(h(LeftIndex, { ui: makeUi() }), host);
    expect(host.querySelector('.icon-rail')).not.toBeNull();
    expect(host.querySelector('.left-index')).toBeNull();
  });

  it('renders the compact rail on a narrow viewport regardless of layout preference', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q) => /** @type {any} */ ({
      matches: q.includes('max-width'), media: q,
      addEventListener: () => {}, removeEventListener: () => {},
    }));
    prender(h(LeftIndex, { ui: makeUi() }), host);
    expect(host.querySelector('.icon-rail')).not.toBeNull();
    expect(host.querySelector('.left-index')).toBeNull();
  });

  it('leaves the CSS with no rail-swapping display rules to maintain', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).not.toMatch(/\.shell__channels > \.icon-rail-host/);
    expect(css).not.toMatch(/\.left-index \{ display: none; \}/);
  });

  it('renders quiet compact empty states with creation CTAs in the left index', () => {
    prender(h(LeftIndex, { ui: makeUi() }), host);
    const compacts = host.querySelectorAll('.icon-rail__empty-compact');
    expect(compacts.length).toBeGreaterThan(0);
    // CTAs are retained
    const ctas = host.querySelectorAll('.empty-state__cta');
    expect(ctas.length).toBeGreaterThan(0);
  });

  it('anchors globalMenu floating popup at bottom-left in chat-shell.css', () => {
    const chatCss = fs.readFileSync(path.join(process.cwd(), 'src/themes/chat-shell.css'), 'utf8');
    expect(chatCss).toMatch(/\.floating-popup\[data-(?:popup-id|floating-popup)="globalMenu"\]/);
    expect(chatCss).toContain('bottom: 48px;');
    expect(chatCss).toContain('left: 12px;');
  });
});


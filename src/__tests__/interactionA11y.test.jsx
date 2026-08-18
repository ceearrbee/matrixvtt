/**
 * Two interaction-a11y gaps: MobileTabBar wore tablist/tab roles that
 * promise arrow-key semantics it never implemented (it switches whole
 * views, so it is honest navigation), and FloatingDoc windows could
 * only be moved with a mouse.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { MobileTabBar } from '../ui/MobileTabBar.jsx';
import { FloatingDocs } from '../ui/FloatingDoc.jsx';
import { mobilePaneSignal, openDocsSignal } from '../state/ui-signals.js';
import { handoutsSignal, pagesSignal } from '../state/signals.js';

let root;

beforeEach(() => {
  mobilePaneSignal.value = 'chat';
  openDocsSignal.value = [];
  handoutsSignal.value = new Map();
  pagesSignal.value = new Map();
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => {
  render(null, root);
  root.remove();
  openDocsSignal.value = [];
});

const flush = () => new Promise((r) => setTimeout(r, 15));

describe('MobileTabBar semantics', () => {
  it('is an honest nav of buttons with aria-current, not a fake tablist', () => {
    const ui = /** @type {any} */ ({ state: { isGM: () => false } });
    render(h(MobileTabBar, { ui }), root);

    expect(root.querySelector('[role="tablist"]')).toBeNull();
    expect(root.querySelector('[role="tab"]')).toBeNull();
    const nav = root.querySelector('nav');
    expect(nav).toBeTruthy();
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toMatch(/chat/i);
  });
});

describe('FloatingDoc keyboard movement', () => {
  it('the drag handle is focusable and arrow keys move the window 16px', async () => {
    const handouts = new Map([['h1', { id: 'h1', title: 'An invitation', body: 'x' }]]);
    handoutsSignal.value = handouts;
    const ui = /** @type {any} */ ({
      state: { handouts, pages: new Map() },
      closeDoc: vi.fn(),
      bringDocToFront: vi.fn(),
    });
    openDocsSignal.value = [{ key: 'handout:h1', kind: 'handout', id: 'h1', z: 100 }];
    render(h(FloatingDocs, { ui }), root);
    await flush();

    const handle = document.querySelector('.floating-doc__handle');
    expect(handle).toBeTruthy();
    expect(handle.tagName).toBe('BUTTON');
    expect(handle.getAttribute('aria-label')).toMatch(/move/i);

    const panel = document.querySelector('.floating-doc');
    const before = parseInt(panel.style.left || '0', 10);
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(parseInt(panel.style.left, 10)).toBe(before + 16);
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const beforeTop = parseInt(panel.style.top || '0', 10);
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(parseInt(panel.style.top, 10)).toBe(beforeTop - 16);
  });
});

/**
 * The in-app "Reduced motion" toggle was a dead checkbox: it toggled
 * html.reduced-motion, but no stylesheet ever styled that class and
 * the Konva map animations never consulted it. These tests pin the
 * effect, not the classList write.
 */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { prefersReducedMotion } from '../utils/reduced-motion.js';

const css = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

afterEach(() => {
  document.documentElement.classList.remove('reduced-motion');
});

describe('reduced-motion CSS parity', () => {
  const NEUTRALIZERS = [
    /animation-duration:\s*0\.01ms\s*!important/,
    /animation-iteration-count:\s*1\s*!important/,
    /transition-duration:\s*0\.01ms\s*!important/,
    /scroll-behavior:\s*auto\s*!important/,
  ];

  function blockFor(selectorPattern) {
    const start = css.search(selectorPattern);
    if (start === -1) return null;
    const open = css.indexOf('{', start);
    let depth = 1;
    let i = open + 1;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth++;
      if (css[i] === '}') depth--;
      i++;
    }
    return css.slice(open, i);
  }

  it('the OS media query neutralizes all animation (existing contract)', () => {
    const block = blockFor(/@media \(prefers-reduced-motion: reduce\)/);
    expect(block).toBeTruthy();
    for (const rule of NEUTRALIZERS) expect(block).toMatch(rule);
  });

  it('the in-app .reduced-motion class applies the same neutralizers', () => {
    const block = blockFor(/:root\.reduced-motion/);
    expect(block).toBeTruthy();
    for (const rule of NEUTRALIZERS) expect(block).toMatch(rule);
  });
});

describe('pre-paint preload', () => {
  it('app.html applies the reduced-motion class before first paint', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'app.html'), 'utf8');
    const preload = html.match(/<script>([^<]*localStorage[^<]*data-theme[^<]*)<\/script>/);
    expect(preload).not.toBeNull();
    expect(preload[1]).toContain('reduced-motion');
  });
});

describe('prefersReducedMotion()', () => {
  it('is true when the in-app class is set', () => {
    document.documentElement.classList.add('reduced-motion');
    expect(prefersReducedMotion()).toBe(true);
  });

  it('is false with no class and no OS preference', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});

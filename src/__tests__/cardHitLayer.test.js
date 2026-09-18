/**
 * `.card__hit` is the stretched invisible button that makes a whole
 * entity card clickable. It is a plain <button>, so the global
 * `button:hover { background: ... }` rule reaches it: hovering a card
 * filled the hit layer with an opaque surface that covered the avatar,
 * the name and the HP bar. Only the per-row action buttons survived,
 * because `.card button:not(.card__hit)` lifts those to z-index 1.
 *
 * The hit layer is a hit area, not a surface. It never paints.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

function backgroundsFor(selectorFragment) {
  const found = [];
  for (const [, selector, body] of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.includes(selectorFragment)) continue;
    for (const [, value] of body.matchAll(/background(?:-color)?:\s*([^;]+);/g)) {
      found.push({ selector: selector.trim().split('\n').pop().trim(), value: value.trim() });
    }
  }
  return found;
}

describe('the card hit layer never paints over the card', () => {
  it('declares a hover background, since the global button:hover reaches it', () => {
    const hovered = backgroundsFor('.card__hit:hover');
    expect(hovered.length, '.card__hit inherits button:hover and covers the card').toBeGreaterThan(0);
  });

  it('keeps every declared background transparent', () => {
    const painted = backgroundsFor('.card__hit').filter((r) => r.value !== 'transparent');
    expect(painted, `the hit layer paints: ${painted.map((r) => `${r.selector} → ${r.value}`).join(', ')}`)
      .toEqual([]);
  });
});

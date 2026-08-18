/**
 * The library and compendium browsers share a scrolling results list,
 * a controls row, and centered status text. Those shared treatments must
 * resolve through the same design tokens (radius + accent) so the two
 * browsers read as one system, per DESIGN.md.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(here, '../styles.css'), 'utf8');

const rule = (selector) => {
  const m = styles.match(
    new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`)
  );
  return m ? m[0] : null;
};

describe('browser shell consistency', () => {
  it('both result containers use the radius token, not a literal 2px', () => {
    for (const sel of ['.compendium-browser__results', '.library-browser__rows']) {
      const block = rule(sel);
      expect(block, `${sel} not found`).not.toBeNull();
      expect(block).toMatch(/border-radius:\s*var\(--border-radius-sm\)/);
      expect(block).not.toMatch(/border-radius:\s*2px/);
    }
  });

  it('the selected library row uses canonical accent tokens (no undefined fallback token)', () => {
    const block = rule('.library-browser__row--active');
    expect(block, '.library-browser__row--active not found').not.toBeNull();
    expect(block).toMatch(/var\(--color-background-info\)/);
    expect(block).not.toMatch(/--color-background-accent-subtle/);
  });
});

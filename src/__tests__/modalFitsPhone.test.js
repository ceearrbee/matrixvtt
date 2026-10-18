/**
 * .modal-content carried min-width: 400px, and min-width beats the
 * phone rule's max-width: 100vw, so every modal ran off both sides of a
 * 320-399px phone.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

describe('modals on a narrow phone', () => {
  it('no modal minimum width is wider than the viewport', () => {
    const rule = css.match(/\n\.modal-content \{([^}]*)\}/);
    expect(rule).not.toBeNull();
    const minWidth = rule[1].match(/min-width:\s*([^;]+);/);
    expect(minWidth?.[1]).toBe('min(400px, 100vw)');
  });
});

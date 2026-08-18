/**
 * Channels rail (the IconRail navigation column) must stay visible in
 * every UI mode, combat included - pinned by reading styles.css
 * directly so happy-dom's partial getComputedStyle doesn't get in
 * the way.
 *
 * Pairs with uiModeCss.test.js - both files exercise the same CSS
 * contract from different angles.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const STYLES = readFileSync(resolve(here, '..', 'styles.css'), 'utf8');

function hasRule(selectorFragment, declarationFragment) {
  const escSel = selectorFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escDecl = declarationFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escSel}\\s*\\{[^}]*${escDecl}[^}]*\\}`, 's');
  return re.test(STYLES);
}

describe('channels rail visibility across UI modes', () => {
  it('Combat does NOT hide the channels rail', () => {
    expect(hasRule('.shell[data-ui-mode="combat"] .shell__channels', 'display: none')).toBe(false);
  });

  it('Combat does NOT zero the channels rail width', () => {
    expect(hasRule('.shell[data-ui-mode="combat"]', '--channels-rail-width: 0px')).toBe(false);
  });

  it('Combat shares the stable, non-zero channels-rail width', () => {
    // The almanac left index is always present, so one rule sets the width
    // for every phase (combat included) rather than a per-mode override.
    expect(STYLES).toContain('.shell[data-ui-mode="combat"]');
    expect(STYLES).toMatch(/--channels-rail-width:\s*248px/);
  });

  it('the retired Exploration block is gone', () => {
    expect(STYLES).not.toContain('[data-ui-mode="exploration"]');
  });
});

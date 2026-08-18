/**
 * Per-mode CSS contract - asserts `src/styles.css` declares the
 * expected visibility rules under each `[data-ui-mode]` selector.
 *
 * Pairs with `uiModeShellAttr.test.jsx` (which verifies App sets the
 * data attribute on `.shell`). Together the two cover the
 * attribute-drives-layout contract without depending on happy-dom's
 * getComputedStyle correctly resolving the production stylesheet.
 *
 * Rule-text matching is intentionally loose (whitespace-insensitive,
 * permits other rules between selector and declaration) so the test
 * doesn't break on cosmetic edits to the block.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const STYLES = readFileSync(resolve(here, '..', 'styles.css'), 'utf8');

function hasRule(selectorFragment, declarationFragment) {
  // Match `<selector> { … <declaration> … }` allowing whitespace and
  // extra declarations between selector and target declaration.
  const escSel = selectorFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escDecl = declarationFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escSel}\\s*\\{[^}]*${escDecl}[^}]*\\}`, 's');
  return re.test(STYLES);
}

describe('per-mode CSS rules in styles.css', () => {
  it('combat keeps the channels rail visible (no display:none)', () => {
    expect(hasRule('.shell[data-ui-mode="combat"] .shell__channels', 'display: none')).toBe(false);
  });

  it('combat does NOT zero the channels rail width', () => {
    expect(hasRule('.shell[data-ui-mode="combat"]', '--channels-rail-width: 0px')).toBe(false);
  });

  it('combat does NOT hide the sheet rail - the companion mounts inside it', () => {
    expect(hasRule('.shell[data-ui-mode="combat"] .shell__sheet', 'display: none')).toBe(false);
  });

  it('declares one stable, non-zero channels-rail width for every phase', () => {
    // The almanac left index is always-expanded - it does not resize per
    // phase, so a single rule covers combat / narrative / gm-prep.
    expect(STYLES).toMatch(/--channels-rail-width:\s*248px/);
    expect(STYLES).toContain('.shell[data-ui-mode="combat"]');
    expect(STYLES).toContain('.shell[data-ui-mode="narrative"]');
    expect(STYLES).toContain('.shell[data-ui-mode="gm-prep"]');
  });

  it('no exploration-mode rules remain', () => {
    expect(STYLES).not.toContain('[data-ui-mode="exploration"]');
  });

  it('initiative panel visibility is mount-side (App.jsx), not CSS', () => {
    // The old `.shell:not([data-ui-mode="combat"]) .initiative-panel`
    // hide rule was retired when App.jsx began conditionally mounting
    // InitiativeBar - CombatSidebar owns the order in Combat mode.
    expect(hasRule('.shell:not([data-ui-mode="combat"]) .initiative-panel', 'display: none')).toBe(false);
  });

  it('.vt-root is a flex column with .shell flex:1 (so the rails own remaining height)', () => {
    expect(hasRule('.vt-root', 'display: flex')).toBe(true);
    expect(hasRule('.vt-root > .shell', 'flex: 1')).toBe(true);
  });

  it('block is bracketed by grep-able BEGIN/END markers', () => {
    expect(STYLES).toContain('/* UI MODE RULES BEGIN */');
    expect(STYLES).toContain('/* UI MODE RULES END */');
  });

  // Without explicit grid-column anchors, hiding .shell__channels (combat)
  // would let .shell__chat flow into column 1 (narrow) and .shell__sheet
  // into column 2 (1fr).
  it('each rail is anchored to its own grid-column', () => {
    expect(hasRule('.shell__channels', 'grid-column: 1')).toBe(true);
    expect(hasRule('.shell__chat', 'grid-column: 2')).toBe(true);
    expect(hasRule('.shell__sheet', 'grid-column: 3')).toBe(true);
  });
});

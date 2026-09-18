/**
 * On a phone `LeftIndex` swaps the accordion for `IconRail`, so the
 * rail's Menu button is the only control that opens the global menu,
 * and with it Settings, Notifications, Maps and Leave. A mobile rule
 * hid that rail inside the Journal pane on the premise that "the
 * bottom tab bar already provides pane navigation" - but the tab bar
 * has no Menu tab, so the premise was wrong and the menu became
 * unreachable at every width below the breakpoint.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STYLES = readFileSync(resolve(import.meta.dirname, '..', 'styles.css'), 'utf8');

function hasRule(selectorFragment, declarationFragment) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${esc(selectorFragment)}\\s*\\{[^}]*${esc(declarationFragment)}[^}]*\\}`, 's').test(
    STYLES
  );
}

describe('the global menu is reachable on a phone', () => {
  it('the Journal pane does not hide the rail that carries Menu', () => {
    expect(hasRule('.shell[data-mobile-pane="journal"] .icon-rail-host .icon-rail', 'display: none')).toBe(
      false
    );
  });

  it('no mobile rule hides the icon rail outright', () => {
    expect(hasRule('.icon-rail', 'display: none')).toBe(false);
  });

  it('the Journal pane is still the pane that shows the rail column', () => {
    expect(hasRule('.shell[data-mobile-pane="journal"] .shell__channels', 'display: block')).toBe(true);
  });
});

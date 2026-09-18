/**
 * A floating doc is a window the reader opens on top of the table.
 * `.floating-docs` used to be `position: relative; z-index: 0`, which
 * is a stacking context: every fixed-positioned panel inside it was
 * pinned to level 0 no matter what z-index it carried, so app chrome
 * at `--z-panel` painted over the panel's header. The drag handle,
 * the title and the close button were covered, the close click landed
 * on the chrome, and only Escape still reached the panel.
 *
 * The panel layer belongs in the `--z-*` scale like every other
 * competing layer, and the host must not trap it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
const source = readFileSync(join(process.cwd(), 'src/ui/FloatingDoc.jsx'), 'utf8');

function ruleBody(selector) {
  const match = styles.match(new RegExp(`\\n\\${selector}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : null;
}

describe('floating docs stack above the app chrome', () => {
  it('the host does not open a stacking context around the panels', () => {
    const host = ruleBody('.floating-docs');
    if (host === null) return; // no rule at all is the strongest form of this
    const positioned = /position:\s*(relative|absolute|fixed|sticky)/.test(host);
    const layered = /z-index:/.test(host);
    expect(positioned && layered, `.floating-docs traps its panels: ${host.trim()}`).toBe(false);
  });

  it('the panel takes its layer from the scale', () => {
    const panel = ruleBody('.floating-doc');
    expect(panel, '.floating-doc rule not found').not.toBeNull();
    expect(panel).toMatch(/z-index:[^;]*--z-/);
  });

  it('the scale declares the panel layer above the chrome and below the drawer', () => {
    const value = (name) => Number(styles.match(new RegExp(`${name}:\\s*(\\d+)`))?.[1]);
    expect(value('--z-floating-doc')).toBeGreaterThan(value('--z-dropdown'));
    expect(value('--z-floating-doc')).toBeLessThan(value('--z-drawer'));
  });

  it('the component carries no raw z-index of its own', () => {
    expect(source).not.toMatch(/z-index:/);
  });
});

/**
 * One modal system. `Modal.jsx` with `openModal()` gives a dialog its
 * focus trap, body-scroll lock, capture-phase Escape and unsaved-changes
 * guard; sixteen overlays hand-rolled a subset of that and drifted -
 * some trapped focus, some did not, and none guarded a dirty form.
 *
 * The rule this pins: no component outside Modal.jsx declares a
 * `.modal-overlay` of its own.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');

function sources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!full.includes('__tests__')) sources(full, out);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push([path.relative(process.cwd(), full), fs.readFileSync(full, 'utf8')]);
    }
  }
  return out;
}

// Modal.jsx owns the markup; modal-host and the helpers query it.
const OWNERS = new Set([
  'src/ui/Modal.jsx',
  'src/ui/modal-host.js',
  'src/utils/modal-helpers.js',
  'src/ui/modal-focus.js',
]);

describe('modal system', () => {
  const files = sources(root);

  it('has exactly one declarer of the overlay markup', () => {
    const declarers = files
      .filter(([rel]) => !OWNERS.has(rel))
      .filter(([, src]) => /class:\s*'modal-overlay'|className\s*=\s*'modal-overlay'/.test(src))
      .map(([rel]) => rel);
    expect(declarers).toEqual([]);
  });

  // Anchored popovers (ChatTonePicker, ComposerActionsPopover) are a
  // separate pattern with no overlay; they keep their own dismissal.
  it('leaves no modal-shaped surface handling its own Escape', () => {
    const handRolled = files
      .filter(([rel]) => !OWNERS.has(rel))
      .filter(([, src]) => /'modal-content/.test(src))
      .filter(([, src]) => /e\.key === 'Escape'/.test(src))
      .map(([rel]) => rel);
    expect(handRolled).toEqual([]);
  });
});

/**
 * A dead end is a surface that tells you something is missing and then
 * offers nothing to do about it. The app had four kinds:
 *
 *  - "No character selected" in three tabs, with no way to pick one.
 *  - Empty lists that described their CTA in prose ("Use + Add Item to
 *    create one") next to a button the reader has to go find.
 *  - Copy that names internals: snapshot, persisted, power level split,
 *    "Cleared 7 local keys", a raw library `kind`.
 *  - An enabled star button that toasted "isn't implemented yet".
 *
 * The one document written to onboard a GM was also unreachable from
 * the app, and the single `docHref` in the help registry bypassed
 * `docsHref()` and 404s in dev.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NoCharacterSelected } from '../ui/NoCharacterSelected.jsx';
import { HELP_TERMS } from '../ui/help-terms.js';
import { buildPaletteCommands } from '../ui/palette-commands.js';
import { TABS } from '../utils/constants.js';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(srcRoot, rel), 'utf8');

afterEach(cleanup);

describe('"No character selected" offers a character', () => {
  it('sends the reader to the roster and offers to make one', () => {
    const ui = /** @type {any} */ ({ switchTab: vi.fn(), showCharacterWizard: vi.fn() });
    const { container } = render(h(NoCharacterSelected, { ui }));
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.length).toBe(2);
    buttons[0].click();
    expect(ui.switchTab).toHaveBeenCalledWith(TABS.PARTY);
    buttons[1].click();
    expect(ui.showCharacterWizard).toHaveBeenCalled();
  });

  it('drops the buttons it cannot wire rather than rendering dead ones', () => {
    const { container } = render(h(NoCharacterSelected, { ui: /** @type {any} */ ({}) }));
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('is the only spelling of it left in the tree', () => {
    for (const f of ['ui/Items.jsx', 'ui/Spells.jsx', 'ui/Skills.jsx']) {
      expect(read(f).includes("'No character selected'"), f).toBe(false);
    }
  });
});

describe('empty lists carry a button, not a sentence about one', () => {
  it('no surface describes its CTA in prose', () => {
    for (const f of ['ui/Items.jsx', 'ui/Spells.jsx']) {
      expect(read(f), f).not.toMatch(/Use \+ Add/);
    }
  });

  it('the bare empty-state div is gone from the list tabs', () => {
    for (const f of ['ui/Items.jsx', 'ui/Spells.jsx', 'ui/Skills.jsx']) {
      expect(read(f), f).not.toMatch(/class: 'empty-state'/);
    }
  });
});

describe('copy stops naming internals', () => {
  it('the discovery screen says what to do, in the words of the product', () => {
    const src = read('standalone/discovery/render.js');
    expect(src).not.toMatch(/session state/i);
  });

  it('the snapshot failure describes a retry, not a persistence model', () => {
    const src = read('ui/setup/save-flow.js');
    expect(src).not.toMatch(/snapshot to the server/);
    expect(src).not.toMatch(/persisted yet/);
  });

  it('the power-level failure is logged in internals, not shown in them', () => {
    const src = read('ui/setup-persistence.js');
    expect(src).not.toMatch(/_toast[^;]*[Pp]ower level split/s);
  });

  it('clearing local storage reports the outcome, not the key count', () => {
    expect(read('ui/sync/debug-bar.js')).not.toMatch(/local keys/);
  });

  it('an unsupported library entry names the entry, not its internal kind', () => {
    const src = read('ui/library/LibraryBrowser.jsx');
    expect(src).not.toMatch(/Unsupported entry type: \$\{entry\.kind\}/);
  });
});

describe('the star button either works or is gone', () => {
  it('no surface admits to being unimplemented', () => {
    expect(read('ui/combat-wiring.js')).not.toMatch(/isn't implemented yet/);
  });
});

describe('the GM quickstart is reachable', () => {
  it('the palette offers it', () => {
    const cmds = buildPaletteCommands(/** @type {any} */ ({}), { isGM: true, combatActive: false });
    expect(cmds.map((c) => c.id)).toContain('gm-quickstart');
  });

  it('the setup wizard links it', () => {
    expect(read('ui/SetupWizard.jsx')).toMatch(/gm-quickstart/);
  });

  it('the docs index lists it', () => {
    const index = readFileSync(resolve(srcRoot, '../docs/index.md'), 'utf8');
    expect(index).toMatch(/guide\/gm-quickstart/);
  });

  it('help-term doc links route through docsHref rather than a raw path', () => {
    for (const [key, entry] of Object.entries(HELP_TERMS)) {
      expect(/** @type {any} */ (entry).docHref, `${key} still holds a raw href`).toBeUndefined();
    }
    expect(/** @type {any} */ (HELP_TERMS.ruleset).docPath).toBe('RULESET-SPEC');
  });
});

/**
 * The palette answers "where is X". It was a noun-finder: seven entity
 * collections, no verbs, and its own docblock called it "Cmd-K-style"
 * while the modal title said "Search". Commands are the half that makes
 * it the way in to a feature you cannot see.
 *
 * Pure and permission-filtered, in the shape buildGlobalMenuItems
 * already uses, so the matrix is testable without a DOM.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildPaletteCommands } from '../ui/palette-commands.js';

const ui = /** @type {any} */ ({
  toggleFog: vi.fn(), revealAllFog: vi.fn(), hideAllFog: vi.fn(),
  rollInitiative: vi.fn(), endCombat: vi.fn(), openMapsPanel: vi.fn(),
  openSettings: vi.fn(), showCharacterWizard: vi.fn(), beginTokenPlacement: vi.fn(),
});

const keys = (opts) => buildPaletteCommands(ui, opts).map((c) => c.id);

describe('palette commands', () => {
  it('offers a player the things a player may actually do', () => {
    const player = keys({ isGM: false, combatActive: false });
    expect(player).toContain('settings');
    expect(player).toContain('shortcuts');
    expect(player).not.toContain('fog-toggle');
    expect(player).not.toContain('reveal-all');
  });

  it('offers a GM the scene tools that otherwise need Prep or a right-click', () => {
    const gm = keys({ isGM: true, combatActive: false });
    for (const id of ['fog-toggle', 'reveal-all', 'hide-all', 'add-token', 'invite', 'maps']) {
      expect(gm, id).toContain(id);
    }
  });

  it('offers to start combat only when none is running, and end it only when one is', () => {
    expect(keys({ isGM: true, combatActive: false })).toContain('roll-initiative');
    expect(keys({ isGM: true, combatActive: false })).not.toContain('end-combat');
    expect(keys({ isGM: true, combatActive: true })).toContain('end-combat');
    expect(keys({ isGM: true, combatActive: true })).not.toContain('roll-initiative');
  });

  it('gives every command a label, a group and something to run', () => {
    for (const c of buildPaletteCommands(ui, { isGM: true, combatActive: false })) {
      expect(c.label.length, c.id).toBeGreaterThan(2);
      expect(typeof c.group, c.id).toBe('string');
      expect(typeof c.run, c.id).toBe('function');
    }
  });

  it('runs the delegate rather than reimplementing it', () => {
    const cmd = buildPaletteCommands(ui, { isGM: true, combatActive: false })
      .find((c) => c.id === 'fog-toggle');
    cmd.run();
    expect(ui.toggleFog).toHaveBeenCalled();
  });
});

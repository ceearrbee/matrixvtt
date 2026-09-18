/**
 * The sheet panel gets a width you can set and that survives a reload.
 *
 * The resize module that shipped was dead in both branches: the only
 * handle rendered, `data-resize="init"`, is display:none inside
 * `.almanac-map`, which is the only place InitiativeBar mounts, and
 * the variable it wrote, `--init-panel-width`, was read by no rule at
 * all. The live variable, `--sheet-panel-width`, is the third grid
 * track of `.shell` and never had a handle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_SHEET_WIDTH, clampSheetPanelWidth,
  readSheetPanelWidth, writeSheetPanelWidth,
} from '../utils/sheet-panel-size.js';

const read = (rel) => readFileSync(join(process.cwd(), rel), 'utf8');

beforeEach(() => {
  localStorage.clear();
  // Pin the viewport so the cap does not depend on the environment.
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1600);
});

describe('clampSheetPanelWidth', () => {
  it('rejects what is not a number', () => {
    for (const bad of [null, undefined, Number.NaN, Infinity]) {
      expect(clampSheetPanelWidth(bad)).toBeNull();
    }
  });

  it('keeps a sensible width untouched', () => {
    expect(clampSheetPanelWidth(320)).toBe(320);
  });

  it('floors a width too narrow to read a sheet in', () => {
    expect(clampSheetPanelWidth(40)).toBe(clampSheetPanelWidth(0));
    expect(clampSheetPanelWidth(40)).toBeGreaterThan(100);
  });

  it('caps a width that would crowd out the map', () => {
    expect(clampSheetPanelWidth(99999)).toBeLessThanOrEqual(800);
  });

  it('rounds rather than storing a fraction', () => {
    expect(clampSheetPanelWidth(320.6)).toBe(321);
  });
});

describe('the stored width', () => {
  it('round-trips for one user in one room', () => {
    writeSheetPanelWidth('@a:hs', '!r:hs', 340);
    expect(readSheetPanelWidth('@a:hs', '!r:hs')).toBe(340);
  });

  it('is nothing before anything is stored', () => {
    expect(readSheetPanelWidth('@a:hs', '!r:hs')).toBeNull();
  });

  it('does not leak between two rooms', () => {
    writeSheetPanelWidth('@a:hs', '!one:hs', 340);
    expect(readSheetPanelWidth('@a:hs', '!two:hs')).toBeNull();
  });

  it('does not leak between two users', () => {
    writeSheetPanelWidth('@a:hs', '!r:hs', 340);
    expect(readSheetPanelWidth('@b:hs', '!r:hs')).toBeNull();
  });

  it('writes nothing when there is no user or room to key on', () => {
    writeSheetPanelWidth(null, '!r:hs', 340);
    writeSheetPanelWidth('@a:hs', null, 340);
    expect(localStorage.length).toBe(0);
  });

  it('clamps on the way in, so a bad stored value cannot break the grid', () => {
    writeSheetPanelWidth('@a:hs', '!r:hs', 99999);
    expect(readSheetPanelWidth('@a:hs', '!r:hs')).toBeLessThanOrEqual(800);
  });

  it('defaults to the width the stylesheet has always used', () => {
    expect(DEFAULT_SHEET_WIDTH).toBe(280);
  });
});

describe('the dead half is gone', () => {
  it('resize-handlers.js no longer exists', () => {
    expect(() => read('src/ui/resize-handlers.js')).toThrow();
  });

  it('no rule declares a variable nothing reads', () => {
    expect(read('src/styles.css')).not.toContain('--init-panel-width');
  });

  it('the initiative bar no longer renders a handle that is always hidden', () => {
    expect(read('src/ui/InitiativeBar.jsx')).not.toContain('data-resize');
  });

  it('the ui surface no longer advertises the setup call', () => {
    expect(read('src/ui/_public-surface.js')).not.toContain('setupResizeHandlers');
  });

  it('the storage prefix with no consumer is gone', () => {
    expect(read('src/utils/constants.js')).not.toContain('CHANNELS_RAIL');
  });
});

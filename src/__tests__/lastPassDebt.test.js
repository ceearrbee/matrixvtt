/**
 * Debt the P0-P5 track left behind: constants whose readers it deleted,
 * docblocks describing behaviour it changed, and one ARIA role whose
 * partner it removed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { STORAGE_KEYS, TOOL_GROUPS } from '../utils/constants.js';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('constants with no readers are gone', () => {
  it('drops the two tour-completion keys, orphaned when the tour was deleted', () => {
    expect(STORAGE_KEYS).not.toHaveProperty('TOUR_COMPLETED');
    expect(STORAGE_KEYS).not.toHaveProperty('TUTORIAL_COMPLETED');
  });

  it('drops the tool group that was never offered as a tab', () => {
    expect(TOOL_GROUPS).not.toHaveProperty('MEASUREMENT');
    // Measure is a Navigation tool, which is where it actually lives.
    expect(read('src/ui/MapStrip.jsx')).toMatch(/NAVIGATION\]:\s*new Set\(\['pointer', 'measure'\]\)/);
  });
});

describe('docblocks describe what the code does', () => {
  it('the header no longer advertises a tour in the global menu', () => {
    expect(read('src/ui/Header.jsx')).not.toMatch(/Tour/);
  });

  it('View Sheet is documented as selecting into the sidebar, not opening a popup', () => {
    const src = read('src/ui/event-wiring.js');
    expect(src).not.toMatch(/preview popup/);
    expect(src).toMatch(/sidebar/i);
  });
});

describe('orphan ARIA is removed', () => {
  it('the log container is not a tabpanel, having no tablist', () => {
    expect(read('src/ui/LogContainer.jsx')).not.toMatch(/role: 'tabpanel'/);
  });
});

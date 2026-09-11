/**
 * The global menu was fifteen flat items with a blind theme cycler in
 * the middle: clicking it stepped through five themes with no preview
 * of where it was going, duplicating the labelled select in Settings >
 * Appearance. Grouping is what NewEntityMenu already does.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildGlobalMenuItems } from '../ui/global-menu-items.js';

const ui = /** @type {any} */ ({
  openSettings: vi.fn(), toggleTheme: vi.fn(),
  openMapsPanel: vi.fn(), toggleDebugMode: vi.fn(),
});

const build = (opts) => buildGlobalMenuItems(ui, opts);

describe('global menu', () => {
  it('drops the blind theme cycler; the labelled select in Settings is the one control', () => {
    const keys = build({ isGM: true, canLeave: true }).map((i) => i.key);
    expect(keys).not.toContain('theme');
    expect(keys).toContain('settings');
  });

  it('drops Toggle debug bar, which lives in Settings > About', () => {
    expect(build({ isGM: true, canLeave: true }).map((i) => i.key)).not.toContain('debug');
  });

  it('declares a group for every item so the menu reads in sections', () => {
    for (const item of build({ isGM: true, canLeave: true })) {
      expect(typeof item.group, item.key).toBe('string');
      expect(item.group.length, item.key).toBeGreaterThan(0);
    }
  });

  // A grouped menu is scanned group by group, so the section is the
  // unit that has to stay short, not the whole list.
  it('keeps every group short enough to scan', () => {
    const perGroup = {};
    for (const item of build({ isGM: true, canLeave: true })) {
      perGroup[item.group] = (perGroup[item.group] ?? 0) + 1;
    }
    for (const [group, n] of Object.entries(perGroup)) {
      expect(n, `${group} has ${n} items`).toBeLessThanOrEqual(5);
    }
  });
});

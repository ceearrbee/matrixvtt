/**
 * Escape closes the drawer that is actually open.
 *
 * The shell tracked `data-channels-open` and `data-sheet-open` from
 * local state that no stylesheet rule ever matched; the mobile pane
 * model superseded them and the scrim is display:none. The drawer that
 * is real is the icon rail's, and nothing closed it from the keyboard.
 *
 * Escape must also stay quiet when no drawer is open, so it never
 * competes with a modal's own Escape for a press neither should share.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { closeOpenDrawer } from '../ui/close-drawer.js';
import { openIconRailDrawerSignal } from '../state/ui-signals.js';
import { ICON_RAIL_DRAWERS } from '../utils/constants.js';

beforeEach(() => { openIconRailDrawerSignal.value = null; });

describe('closeOpenDrawer', () => {
  it('closes an open drawer and says it handled the press', () => {
    openIconRailDrawerSignal.value = ICON_RAIL_DRAWERS.JOURNAL;
    expect(closeOpenDrawer()).toBe(true);
    expect(openIconRailDrawerSignal.value).toBeNull();
  });

  it('does nothing and says so when none is open', () => {
    expect(closeOpenDrawer()).toBe(false);
    expect(openIconRailDrawerSignal.value).toBeNull();
  });

  it('is safe to press twice', () => {
    openIconRailDrawerSignal.value = ICON_RAIL_DRAWERS.SCENES;
    expect(closeOpenDrawer()).toBe(true);
    expect(closeOpenDrawer()).toBe(false);
  });
});

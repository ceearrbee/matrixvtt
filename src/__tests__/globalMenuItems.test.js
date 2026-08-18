/**
 * buildGlobalMenuItems - pure source of truth for the consolidated
 * global-actions menu (lower-left ☰). GM-gates Maps, canLeave-gates
 * Leave, and every row delegates to an existing handler.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildGlobalMenuItems } from '../ui/global-menu-items.js';

const ui = { openSettings() {}, toggleTheme() {}, openMapsPanel() {} };

describe('buildGlobalMenuItems', () => {
  it('always includes Notifications, Settings, Theme, Tour, Shortcuts, Feedback, Debug', () => {
    const keys = buildGlobalMenuItems(ui, { isGM: false, canLeave: false }).map((i) => i.key);
    expect(keys).toEqual(
      expect.arrayContaining(['notifications', 'settings', 'theme', 'tour', 'keys', 'feedback', 'debug']),
    );
  });

  it('carries the folded chat-tool popups: browse log, OOC panel, chat helpers', () => {
    const keys = buildGlobalMenuItems(ui, { isGM: false, canLeave: false }).map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(['browse', 'ooc', 'chatHelpers']));
  });

  it('includes a Documentation link that opens the docs site under the deploy base', () => {
    const open = vi.fn();
    const withWin = { ...ui, win: { open } };
    const docs = buildGlobalMenuItems(withWin, { isGM: false, canLeave: false })
      .find((i) => i.key === 'docs');
    expect(docs).toBeTruthy();
    expect(docs.label).toBe('Documentation');
    docs.action();
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/docs\/$/), '_blank', 'noopener');
  });

  it('includes Maps only for the GM', () => {
    expect(buildGlobalMenuItems(ui, { isGM: false, canLeave: false }).some((i) => i.key === 'maps')).toBe(false);
    expect(buildGlobalMenuItems(ui, { isGM: true, canLeave: false }).some((i) => i.key === 'maps')).toBe(true);
  });

  it('includes Leave only when canLeave', () => {
    expect(buildGlobalMenuItems(ui, { isGM: false, canLeave: false }).some((i) => i.key === 'leave')).toBe(false);
    const leave = buildGlobalMenuItems(ui, { isGM: false, canLeave: true }).find((i) => i.key === 'leave');
    expect(leave).toBeTruthy();
    expect(leave.danger).toBe(true);
  });

  it('includes Content library only in standalone mode with a raw client', () => {
    expect(buildGlobalMenuItems(ui, { isGM: false, canLeave: false }).some((i) => i.key === 'library')).toBe(false);
    const standalone = {
      ...ui,
      widgetManager: { isAppClient: true, getMatrixClient: () => ({}) },
    };
    expect(buildGlobalMenuItems(standalone, { isGM: false, canLeave: false }).some((i) => i.key === 'library')).toBe(true);
    const widget = {
      ...ui,
      widgetManager: { isAppClient: false, getMatrixClient: () => null },
    };
    expect(buildGlobalMenuItems(widget, { isGM: false, canLeave: false }).some((i) => i.key === 'library')).toBe(false);
  });

  it('every item carries a label and a callable action', () => {
    for (const item of buildGlobalMenuItems(ui, { isGM: true, canLeave: true })) {
      expect(typeof item.label).toBe('string');
      expect(typeof item.action).toBe('function');
    }
  });

  it('debug toggles via ui.toggleDebugMode - _debugMode is getter-only', () => {
    const toggleDebugMode = vi.fn();
    const uiWithGetter = { ...ui, toggleDebugMode };
    // Mirror the real ui controller: assigning _debugMode throws.
    Object.defineProperty(uiWithGetter, '_debugMode', { get: () => false });

    const debug = buildGlobalMenuItems(uiWithGetter, { isGM: false, canLeave: false })
      .find((i) => i.key === 'debug');
    expect(() => debug.action()).not.toThrow();
    expect(toggleDebugMode).toHaveBeenCalledOnce();
  });
});

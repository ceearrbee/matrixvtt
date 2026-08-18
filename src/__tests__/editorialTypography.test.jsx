/**
 * Editorial typography smoke: confirms the new eyebrow / heading /
 * body classes render with the right semantic structure on the four
 * welcome surfaces. Pixel-perfect typography is intentionally not
 * asserted - the test pins the *rhythm*, not the font metrics.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';

let host;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { render(null, host); host.remove(); });

describe('editorial typography rhythm', () => {
  it('MapEmptyPlaceholder uses eyebrow + editorial-heading + editorial-body', async () => {
    const { MapStrip } = await import('../ui/MapStrip.jsx');
    const ui = {
      state: { isGM: () => true, map: null },
      openMapsPanel: () => {},
      dismissMapHelp: () => {},
    };
    render(h(MapStrip, { ui }), host);
    // The empty placeholder is mounted because state.map is falsy.
    expect(host.querySelector('.eyebrow')?.textContent).toMatch(/the table/i);
    expect(host.querySelector('.editorial-heading')?.textContent).toMatch(/no active map/i);
    expect(host.querySelector('.editorial-body')).not.toBeNull();
  });

  it('ScenesForum empty state renders the editorial triplet', async () => {
    const { ScenesForum } = await import('../ui/ScenesForum.jsx');
    // Empty activityLog → empty state branch.
    const ui = { activityLog: [], state: { widgetManager: { roomId: '!r:s', userId: '@u:s' } }, widgetManager: { userId: '@u:s' } };
    render(h(ScenesForum, { ui }), host);
    expect(host.querySelector('.eyebrow')?.textContent).toMatch(/forum/i);
    expect(host.querySelector('.editorial-heading')?.textContent).toMatch(/no scenes yet/i);
    expect(host.querySelector('.editorial-body')).not.toBeNull();
  });

  it('SetupWizard header and body use eyebrow + heading + body', async () => {
    const { renderSetupWizard } = await import('../ui/SetupWizard.jsx');
    const ui = {
      state: { constructor: { getGameSystemPresets: () => ({ dnd5e: { meta: { name: 'D&D 5e' } } }) }, settings: {} },
      widgetManager: { userId: '@gm:s', roomId: '!r:s', isAppClient: true },
      showFirstTimeSetup: () => {},
      _toast: () => {},
    };
    renderSetupWizard(ui);
    try {
      expect(document.querySelector('.modal-header .eyebrow')).not.toBeNull();
      expect(document.querySelector('.modal-content .editorial-heading')).not.toBeNull();
      expect(document.querySelector('.modal-body .editorial-body')).not.toBeNull();
    } finally {
      // Tear down the modal overlay the wizard created.
      document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
    }
  });
});

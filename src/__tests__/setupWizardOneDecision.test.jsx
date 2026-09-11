/**
 * The setup wizard is one decision: create the campaign. The API and
 * Performance group had correct defaults and no reader, the four import
 * rows fanned out a first-run screen, and three competing CTAs made the
 * primary action ambiguous.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMinimalUI } from '../ui/ui-methods.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class { constructor() {} render() {} destroy() {} },
}));

function makeUI() {
  const state = {
    tokens: new Map(), characters: new Map(), npcs: new Map(),
    items: new Map(), handouts: new Map(), tables: new Map(), maps: new Map(),
    settings: { systemConfig: null },
    constructor: {
      getGameSystemPresets: () => ({ dnd5e: { meta: { name: 'D&D 5e' } } }),
    },
  };
  const widgetManager = {
    userIdResolved: true, isAppClient: true,
    canEditRoomState: vi.fn().mockResolvedValue(true),
  };
  return createMinimalUI(state, widgetManager, null);
}

async function openWizard() {
  const ui = makeUI();
  await ui.showFirstTimeSetup({ bypassAuthCheck: true });
  return ui;
}

describe('setup wizard, stripped to one decision', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('drops the API and Performance group, which had correct defaults and no reader', async () => {
    await openWizard();
    expect(document.querySelector('#setup-perf-drag')).toBeNull();
    expect(document.querySelector('#setup-perf-announcements')).toBeNull();
    expect(document.body.textContent).not.toMatch(/API & Performance/i);
  });

  it('folds the import rows into a collapsed disclosure', async () => {
    await openWizard();
    const details = document.querySelector('.wizard-options details');
    expect(details).not.toBeNull();
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.querySelector('summary').textContent).toMatch(/import existing content/i);
    expect(details.querySelectorAll('input[type="file"]').length).toBe(4);
  });

  it('offers one primary action and one text link, not three CTAs', async () => {
    await openWizard();
    const actions = document.querySelector('.wizard-actions');
    expect(actions.querySelectorAll('.btn-primary').length).toBe(1);
    expect(actions.querySelectorAll('button').length).toBe(2);
    expect(document.querySelector('[data-wizard-back]')).toBeNull();
    expect(document.querySelector('[data-wizard-open-room]')).not.toBeNull();
  });

  it('drops the step-counter eyebrow, since there is exactly one step and no 02', async () => {
    await openWizard();
    expect(document.querySelector('.wizard-eyebrow').textContent).not.toMatch(/\d/);
    expect(document.body.textContent).not.toMatch(/01 - Start/);
  });

  it('states what the selected system ships, at the picker', async () => {
    await openWizard();
    expect(document.querySelector('#campaign-system-note').textContent.length).toBeGreaterThan(10);
  });
});

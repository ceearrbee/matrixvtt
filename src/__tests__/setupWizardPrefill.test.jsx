/**
 * A GM who named the campaign and picked a system at room creation is
 * not asked again: the wizard confirms the choice instead of
 * re-collecting it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMinimalUI } from '../ui/ui-methods.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class { constructor() {} render() {} destroy() {} },
}));

function makeUI(pendingCampaign) {
  const state = {
    tokens: new Map(), characters: new Map(), npcs: new Map(),
    items: new Map(), handouts: new Map(), tables: new Map(), maps: new Map(),
    settings: { systemConfig: null },
    constructor: {
      getGameSystemPresets: () => ({
        dnd5e: { meta: { name: 'D&D 5e' } },
        fate: { meta: { name: 'FATE Core' } },
      }),
    },
  };
  const widgetManager = {
    userIdResolved: true, isAppClient: true,
    canEditRoomState: vi.fn().mockResolvedValue(true),
  };
  const ui = createMinimalUI(state, widgetManager, null);
  ui._pendingCampaign = pendingCampaign;
  return ui;
}

describe('setup wizard with a campaign chosen at creation', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('drops the duplicate name and system fields', async () => {
    const ui = makeUI({ name: 'Chronicles of the Deep', system: 'fate' });
    await ui.showFirstTimeSetup({ bypassAuthCheck: true });
    expect(document.querySelector('#campaign-name')).toBeNull();
    expect(document.querySelector('#campaign-system')).toBeNull();
  });

  it('reads the chosen name and system back so the GM can check them', async () => {
    const ui = makeUI({ name: 'Chronicles of the Deep', system: 'fate' });
    await ui.showFirstTimeSetup({ bypassAuthCheck: true });
    const summary = document.querySelector('.wizard-summary');
    expect(summary.textContent).toContain('Chronicles of the Deep');
    expect(summary.textContent).toContain('FATE Core');
  });

  it('still collects both when the room was entered without a choice', async () => {
    const ui = makeUI(null);
    await ui.showFirstTimeSetup({ bypassAuthCheck: true });
    expect(document.querySelector('#campaign-name')).not.toBeNull();
    expect(document.querySelector('#campaign-system')).not.toBeNull();
  });
});

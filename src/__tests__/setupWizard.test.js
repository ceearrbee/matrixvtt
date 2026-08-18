import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMinimalUI } from '../ui/ui-methods.js';

vi.mock('../map-renderer.js', () => ({
  MapRenderer: class {
    constructor() {}
    render() {}
    destroy() {}
  },
}));

function makeUI() {
  const state = {
    tokens: new Map(),
    characters: new Map(),
    npcs: new Map(),
    items: new Map(),
    handouts: new Map(),
    tables: new Map(),
    maps: new Map(),
    settings: { systemConfig: null },
    constructor: {
      getGameSystemPresets: () => ({
        dnd5e: { name: 'D&D 5e' },
        pf2e: { name: 'Pathfinder 2e' },
      }),
    },
  };
  const widgetManager = {
    userIdResolved: true,
    isAppClient: false,
    canEditRoomState: vi.fn().mockResolvedValue(true),
  };
  return createMinimalUI(state, widgetManager, null);
}

function findButtonByText(text) {
  return [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(text),
  );
}

describe('showFirstTimeSetup (Preact)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the blank-campaign form without a fake one-option choice card', async () => {
    const ui = makeUI();

    await ui.showFirstTimeSetup({ bypassAuthCheck: true });

    // A "choice" UI with exactly one pre-selected card is noise.
    expect(document.querySelector('.setup-option')).toBeNull();
    expect(findButtonByText('Create Blank Campaign')).toBeTruthy();
    // blank-specific inputs render
    expect(document.querySelector('#campaign-name')).not.toBeNull();
  });

  it('names the escape hatch honestly and explains its consequence', async () => {
    const ui = makeUI();

    await ui.showFirstTimeSetup({ bypassAuthCheck: true });

    const skip = document.querySelector('[data-wizard-open-room]');
    expect(skip).toBeTruthy();
    expect(skip.textContent).toMatch(/skip setup for now/i);
    expect(document.body.textContent).toMatch(/setup .*returns|comes back|next visit/i);
  });
});

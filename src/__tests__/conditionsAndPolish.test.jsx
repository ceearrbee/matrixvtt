import { describe, it, expect, afterEach } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { Conditions } from '../ui/character-sheet-sections/display.js';
import { normalizeEmDashes } from '../utils/format.js';
import { loadMoreHistory } from '../ui/log-panel.js';

afterEach(() => cleanup());

const make2dCtx = () => {
  const base = {
    canvas: null, fillStyle: '', strokeStyle: '', font: '',
    globalAlpha: 1, lineWidth: 1, textAlign: '', textBaseline: '',
    shadowColor: '', shadowBlur: 0, lineCap: '', lineJoin: '',
    scale: () => {},
    rect: () => {},
    arc: () => {},
    beginPath: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    moveTo: () => {},
    lineTo: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: (str) => ({ width: (str ? String(str).length : 10) * 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
};
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (kind) {
    if (kind === '2d') {
      const ctx = make2dCtx();
      ctx.canvas = this;
      return ctx;
    }
    return null;
  };
}

describe('Conditions section rendering', () => {
  it('renders active conditions as badge pills in a conditions list', () => {
    const character = { conditions: ['stealth', 'hidden', 'poisoned'] };
    const { container } = render(h(Conditions, { character }));
    const list = container.querySelector('.sheet-conditions-list');
    expect(list).not.toBeNull();
    const pills = container.querySelectorAll('.sheet-condition-pill');
    expect(pills.length).toBe(3);
    expect(pills[0].textContent).toBe('stealth');
    expect(pills[1].textContent).toBe('hidden');
    expect(pills[2].textContent).toBe('poisoned');
    expect(container.querySelector('.entity-subtitle--none')).toBeNull();
  });

  it('renders None active subtitle when condition list is empty', () => {
    const character = { conditions: [] };
    const { container } = render(h(Conditions, { character }));
    expect(container.querySelector('.sheet-conditions-list')).toBeNull();
    const none = container.querySelector('.entity-subtitle--none');
    expect(none).not.toBeNull();
    expect(none.textContent).toBe('None active');
  });
});

describe('normalizeEmDashes utility', () => {
  it('converts spaced em-dashes to spaced hyphens', () => {
    expect(normalizeEmDashes('Session 3 \u2014 Smoke on the Horizon'))
      .toBe('Session 3 - Smoke on the Horizon');
    expect(normalizeEmDashes('The Sunken Keep \u2014 GM Notes'))
      .toBe('The Sunken Keep - GM Notes');
  });

  it('converts unspaced em-dashes to a single hyphen', () => {
    expect(normalizeEmDashes('Word\u2014another')).toBe('Word-another');
  });

  it('handles nullish or non-string values safely', () => {
    expect(normalizeEmDashes(null)).toBe('');
    expect(normalizeEmDashes(undefined)).toBe('');
    expect(normalizeEmDashes('')).toBe('');
  });
});

describe('Historical message markdown rendering', () => {
  it('formats historical dice rolls through formatSayLogBody without raw asterisks or duplicate names', async () => {
    const ui = {
      _seenLogEventIds: new Set(),
      activityLog: [],
      state: {
        characters: new Map(),
        tokens: new Map(),
      },
      widgetManager: {
        getApi: () => ({
          hasMoreHistory: true,
          getMessages: async () => ({
            chunk: [
              {
                type: 'm.room.message',
                event_id: '$dice_1',
                sender: '@crb:example.org',
                origin_server_ts: 1600000000000,
                content: {
                  msgtype: 'm.text',
                  body: '🎲 crb rolled 1d20: **15** (15)',
                },
              },
            ],
            end: null,
          }),
        }),
      },
    };

    await loadMoreHistory(ui);
    expect(ui.activityLog.length).toBe(1);
    const entry = ui.activityLog[0];
    expect(entry.html).toContain('<strong>15</strong>');
    expect(entry.html).not.toContain('**15**');
    expect(entry.html).not.toContain('<b>crb</b>: 🎲');
    expect(entry.html).toContain('🎲 crb rolled 1d20:');
  });
});

describe('JSX text node em-dash normalization', () => {
  it('normalizes em-dashes in Header title and presence displayname', async () => {
    const { Header } = await import('../ui/Header.jsx');
    const ui = {
      state: {
        settings: { name: 'Campaign \u2014 Chapter 1' },
        initiative: { active: false, round: 1, current_index: 0, order: [] },
        roomMembers: [{ userId: '@alice:example.org', displayname: 'Alice \u2014 The Brave' }],
        isGM: () => false,
      },
    };
    const { container } = render(h(Header, { ui }));
    const titleEl = container.querySelector('.vtt-header__title');
    expect(titleEl).not.toBeNull();
    expect(titleEl.textContent).toBe('Campaign - Chapter 1');
    expect(titleEl.textContent).not.toContain('\u2014');
  });

  it('normalizes em-dashes in ScenesDrawer and JournalDrawer titles', async () => {
    const { ScenesDrawer, JournalDrawer } = await import('../ui/index-sections.js');
    const uiScenes = {
      activityLog: [{
        isSceneRoot: true,
        eventId: '$scene_1',
        sceneTitle: 'Session 3 \u2014 Smoke on the Horizon',
        sender: '@crb:example.org',
      }],
    };
    const { container: scenesContainer } = render(h(ScenesDrawer, { ui: uiScenes }));
    const rowTitle = scenesContainer.querySelector('.icon-rail__row-title');
    expect(rowTitle).not.toBeNull();
    expect(rowTitle.textContent).toBe('Session 3 - Smoke on the Horizon');
    expect(rowTitle.textContent).not.toContain('\u2014');

    const uiJournal = {
      state: {
        isGM: () => false,
        handouts: new Map([['h1', { id: 'h1', title: 'The Sunken Keep \u2014 GM Notes', visible_to_players: true }]]),
        pages: new Map(),
      },
    };
    const { container: journalContainer } = render(h(JournalDrawer, { ui: uiJournal }));
    const handoutTitle = journalContainer.querySelector('.icon-rail__row-title');
    expect(handoutTitle).not.toBeNull();
    expect(handoutTitle.textContent).toBe('The Sunken Keep - GM Notes');
    expect(handoutTitle.textContent).not.toContain('\u2014');
  });

  it('normalizes em-dashes in LogPanel scene card title', async () => {
    const { LogPanel } = await import('../ui/LogPanel.jsx');
    const ui = {
      activityLog: [{
        isSceneRoot: true,
        eventId: '$scene_card_1',
        sceneTitle: 'Act I \u2014 The Arrival',
        ts: '12:00',
        html: '<p>Opening narrative</p>',
      }],
      state: {
        isGM: () => false,
        tokens: new Map(),
      },
    };
    const { container } = render(h(LogPanel, { ui }));
    const sceneTitle = container.querySelector('.log-scene-card__title');
    expect(sceneTitle).not.toBeNull();
    expect(sceneTitle.textContent).toBe('Act I - The Arrival');
    expect(sceneTitle.textContent).not.toContain('\u2014');
  });
});

describe('Map layer boundary clipping and token label scaling', () => {
  it('clips templates, overlays, and drawings layers to the map boundary', async () => {
    const Konva = (await import('konva')).default;
    const { createTemplatesLayer } = await import('../map/layers/templates.js');
    const { createOverlaysLayer } = await import('../map/layers/overlays.js');
    const { createDrawingsLayer } = await import('../map/layers/drawings.js');
    const { createWallsLayer } = await import('../map/layers/walls.js');
    const { activeMapIdSignal, mapsSignal } = await import('../state/signals.js');

    const container = document.createElement('div');
    const stage = new Konva.Stage({ container, width: 800, height: 600 });
    const mr = {
      zoom: 1,
      state: {
        map: { cell_px: 50, width_cells: 10, height_cells: 10 },
        tokens: new Map(),
      },
    };
    activeMapIdSignal.value = 'map-test';
    mapsSignal.value = new Map([['map-test', mr.state.map]]);

    const tLayer = createTemplatesLayer(stage, mr);
    expect(typeof tLayer.layer.clipFunc()).toBe('function');
    const mockCtxT = { rect: (x, y, width, height) => { expect(width).toBe(500); expect(height).toBe(500); } };
    tLayer.layer.clipFunc()(mockCtxT);
    tLayer.dispose();

    const oLayer = createOverlaysLayer(stage, mr);
    oLayer.sync();
    expect(typeof oLayer.layer.clipFunc()).toBe('function');
    const mockCtxO = { rect: (x, y, width, height) => { expect(width).toBe(500); expect(height).toBe(500); } };
    oLayer.layer.clipFunc()(mockCtxO);

    const dLayer = createDrawingsLayer(stage, mr);
    expect(typeof dLayer.layer.clipFunc()).toBe('function');
    const mockCtxD = { rect: (x, y, width, height) => { expect(width).toBe(500); expect(height).toBe(500); } };
    dLayer.layer.clipFunc()(mockCtxD);
    dLayer.dispose();

    const wLayer = createWallsLayer(stage, mr);
    expect(typeof wLayer.layer.clipFunc()).toBe('function');
    const mockCtxW = { rect: (x, y, width, height) => { expect(width).toBe(500); expect(height).toBe(500); } };
    wLayer.layer.clipFunc()(mockCtxW);
    wLayer.dispose();

    stage.destroy();
  });

  it('allows token labels at least 140px on screen when zoomed out', async () => {
    const Konva = (await import('konva')).default;
    const { createTokensLayer } = await import('../map/layers/tokens.js');
    const { tokensSignal, activeMapIdSignal } = await import('../state/signals.js');

    const container = document.createElement('div');
    const stage = new Konva.Stage({ container, width: 800, height: 600 });
    const mr = {
      zoom: 0.5,
      _tokenImages: new Map(),
      _colors: {},
      state: {
        isGM: () => true,
        map: { cell_px: 40, width_cells: 10, height_cells: 10 },
        tokens: new Map(),
        fog: { revealed: [] },
        settings: {},
        initiative: { active: false, order: [], current_index: 0 },
        widgetManager: { userId: '@crb:example.org' },
      },
    };

    activeMapIdSignal.value = 'map-zoom';
    const { layer, groups, dispose } = createTokensLayer(stage, mr);
    tokensSignal.value = new Map([
      ['tok-orc', { id: 'tok-orc', map_id: 'map-zoom', col: 2, row: 2, size: 1, name: 'Goblin Warchief' }],
    ]);

    const group = groups.get('tok-orc');
    expect(group).toBeDefined();
    const nameNode = group.findOne((n) => n.attrs?.name === 'name');
    expect(nameNode).toBeDefined();
    // At zoom 0.5, maxLabelWidth is Math.max(radius * 4, 140 / 0.5 = 280 world px).
    // The width should not be clamped to radius * 4 (~72px).
    expect(nameNode.width()).toBeGreaterThan(72);

    dispose();
    stage.destroy();
  });
});



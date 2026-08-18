import { describe, it, expect } from 'vitest';
import { EVENT_TYPES, PAGE_KINDS, PAGE_VISIBILITY, TABS } from '../utils/constants.js';
import { YjsManager } from '../state/YjsManager.js';
import { StateManager } from '../state/StateManager.js';

describe('Pages constants', () => {
  it('declares EVENT_TYPES.PAGE', () => {
    expect(EVENT_TYPES.PAGE).toBe('com.vtt.page');
  });
  it('declares the four page kinds', () => {
    expect(PAGE_KINDS).toEqual({
      JOURNAL: 'journal', LORE: 'lore', FICTION: 'fiction', PREP: 'prep',
    });
  });
  it('declares the three visibilities', () => {
    expect(PAGE_VISIBILITY).toEqual({
      PRIVATE: 'private', GM: 'gm', PLAYERS: 'players',
    });
  });
  it('declares TABS.PAGES', () => {
    expect(TABS.PAGES).toBe('pages');
  });
});

describe('YjsManager pages collection', () => {
  it('exposes pagesMap and pages bridge', () => {
    const ym = new YjsManager('!room:server');
    expect(ym.pagesMap).toBeDefined();
    expect(typeof ym.pagesMap.set).toBe('function');
    expect(ym.pages).toBeDefined();
    expect(typeof ym.pages.get).toBe('function');
  });

  it('round-trips pagesMap writes through the bridge', () => {
    const ym = new YjsManager('!room:server');
    const testPage = { id: 'p1', title: 'Test Page', kind: 'journal', visibility: 'private' };
    ym.pagesMap.set('p1', testPage);
    expect(ym.pagesMap.get('p1')).toEqual(testPage);
  });
});

function makeSM() {
  const widgetManager = { roomId: '!r:s', userId: '@u:s', init: async () => {}, getApi: () => null };
  return new StateManager(widgetManager, {});
}

describe('StateManager pages collection', () => {
  it('exposes sm.pages as a ReactiveMap', () => {
    const sm = makeSM();
    expect(sm.pages).toBeDefined();
    expect(typeof sm.pages.set).toBe('function');
    expect(typeof sm.pages.get).toBe('function');
    expect(sm.pages.size).toBe(0);
  });
});

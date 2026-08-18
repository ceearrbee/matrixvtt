/**
 * Verifies that the Pages component pipeline reacts to pagesSignal changes.
 *
 * Rendering Pages.jsx requires renderMarkdown, canEditPage, and a fully-wired
 * ui controller - too much DOM scaffolding for a focused signal test. Instead
 * we exercise the pure pipeline used by the component:
 *   applyPageFilters(getVisiblePages(sm), opts)
 * and assert that when sm.pages changes, the filtered output changes too.
 * This form was chosen per the brief's fallback guidance.
 */
import { describe, it, expect } from 'vitest';
import { getVisiblePages } from '../state/reader.js';
import { applyPageFilters } from '../ui/usePageFilters.js';

function makeSm(pages, { userId = '@gm:hs', gm = true } = {}) {
  return {
    pages: new Map(pages.map((p) => [p.id, p])),
    widgetManager: { userId },
    settings: { systemConfig: {} },
    powerLevels: gm ? { users: { [userId]: 50 } } : null,
  };
}

const page1 = { id: 'p1', kind: 'lore', title: 'Blackmoor', body: '', visibility: 'players', author: '@gm:hs', updated_at: 100 };
const page2 = { id: 'p2', kind: 'journal', title: 'Session 1', body: '', visibility: 'gm', author: '@gm:hs', updated_at: 200 };

describe('applyPageFilters(getVisiblePages(sm)) reacts to sm.pages changes', () => {
  it('empty pages map yields empty output', () => {
    const sm = makeSm([]);
    expect(applyPageFilters(getVisiblePages(sm), {})).toHaveLength(0);
  });

  it('adding a page increases visible output', () => {
    const sm1 = makeSm([page1]);
    expect(applyPageFilters(getVisiblePages(sm1), {})).toHaveLength(1);

    // Simulate pagesSignal firing: consumer calls getVisiblePages on new sm
    const sm2 = makeSm([page1, page2]);
    const out = applyPageFilters(getVisiblePages(sm2), {});
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('removing a page decreases visible output', () => {
    const sm = makeSm([page1, page2]);
    expect(applyPageFilters(getVisiblePages(sm), {})).toHaveLength(2);

    const smAfter = makeSm([page1]);
    expect(applyPageFilters(getVisiblePages(smAfter), {})).toHaveLength(1);
  });

  it('non-GM does not see gm-visibility pages', () => {
    const sm = makeSm([page1, page2], { userId: '@player:hs', gm: false });
    const out = applyPageFilters(getVisiblePages(sm), {});
    expect(out.map((p) => p.id)).toEqual(['p1']);
  });

  it('kind filter narrows output after pages change', () => {
    const sm = makeSm([page1, page2]);
    const out = applyPageFilters(getVisiblePages(sm), { kind: 'lore' });
    expect(out.map((p) => p.id)).toEqual(['p1']);
  });

  it('visibility filter mine returns only authored pages', () => {
    const foreign = { ...page1, id: 'p3', author: '@other:hs' };
    const sm = makeSm([page1, page2, foreign]);
    const out = applyPageFilters(getVisiblePages(sm), { visibility: 'mine', me: '@gm:hs' });
    expect(out.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });
});

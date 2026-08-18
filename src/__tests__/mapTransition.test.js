/**
 * `[[map:<id>]]` wikilinks resolve to a map-switch
 * anchor, and clicking that anchor invokes the existing `switchMap`
 * writer rather than inventing a second map-switch pathway.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderWikilinks } from '../utils/wikilinks.js';
import { dispatchMapWikilink } from '../ui/maps/wikilink.js';

describe('renderWikilinks - map references', () => {
  const maps = new Map([
    ['map-1', { name: 'Goblin Camp' }],
    ['map-2', { name: 'The Docks' }],
  ]);

  it('resolves a known map reference to a data-map-id anchor', () => {
    const html = renderWikilinks('Head to [[map:map-1]].', new Map(), null, { maps });
    expect(html).toBe(
      'Head to <a href="#" data-map-id="map-1" class="wikilink wikilink--map">🗺️ Goblin Camp</a>.',
    );
  });

  it('ignores an unknown map id and renders a broken span', () => {
    const html = renderWikilinks('Head to [[map:map-missing]].', new Map(), null, { maps });
    expect(html).toBe('Head to <span class="wikilink wikilink--broken">map:map-missing</span>.');
  });

  it('escapes the map name', () => {
    const html = renderWikilinks('[[map:map-3]]', new Map(), null, {
      maps: new Map([['map-3', { name: '<script>' }]]),
    });
    expect(html).toContain('&lt;script&gt;');
  });
});

function makeLink(mapId) {
  return { getAttribute: (name) => (name === 'data-map-id' ? mapId : null) };
}

describe('dispatchMapWikilink', () => {
  it('calls switchMap with the resolved map id', () => {
    const switchMap = vi.fn().mockResolvedValue(undefined);
    const ui = { state: { switchMap } };
    const consumed = dispatchMapWikilink(ui, makeLink('map-1'));
    expect(consumed).toBe(true);
    expect(switchMap).toHaveBeenCalledWith('map-1');
  });

  it('does nothing and reports unconsumed when the link has no map id', () => {
    const switchMap = vi.fn();
    const ui = { state: { switchMap } };
    const consumed = dispatchMapWikilink(ui, makeLink(null));
    expect(consumed).toBe(false);
    expect(switchMap).not.toHaveBeenCalled();
  });

  it('surfaces a rejected switchMap without throwing', async () => {
    const switchMap = vi.fn().mockRejectedValue(new Error('Only the GM can switch maps.'));
    const ui = { state: { switchMap } };
    expect(() => dispatchMapWikilink(ui, makeLink('map-1'))).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});

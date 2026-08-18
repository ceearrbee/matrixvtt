/**
 * [[Target]] wikilinks render as anchor tags when a matching
 * handout exists; plain text otherwise.
 */

import { describe, it, expect } from 'vitest';
import { renderWikilinks } from '../utils/wikilinks.js';

describe('renderWikilinks', () => {
  const titleToId = new Map([
    ['Goblin Camp', 'hand-1'],
    ['The Docks',   'hand-2'],
  ]);

  it('leaves text without wikilinks untouched', () => {
    expect(renderWikilinks('Just plain text.', titleToId))
      .toBe('Just plain text.');
  });

  it('converts a known wikilink into an anchor with data-handout-id', () => {
    expect(renderWikilinks('See [[Goblin Camp]].', titleToId))
      .toBe('See <a href="#" data-handout-id="hand-1" class="wikilink">Goblin Camp</a>.');
  });

  it('unknown title becomes a broken span so authors can spot dead links', () => {
    expect(renderWikilinks('Visit [[Ghost Town]].', titleToId))
      .toBe('Visit <span class="wikilink wikilink--broken">Ghost Town</span>.');
  });

  it('escapes HTML in titles', () => {
    expect(renderWikilinks('Danger: [[<script>]].', titleToId))
      .toBe('Danger: <span class="wikilink wikilink--broken">&lt;script&gt;</span>.');
  });

  it('handles multiple links in one string', () => {
    expect(renderWikilinks('[[Goblin Camp]] then [[The Docks]].', titleToId))
      .toBe('<a href="#" data-handout-id="hand-1" class="wikilink">Goblin Camp</a> then <a href="#" data-handout-id="hand-2" class="wikilink">The Docks</a>.');
  });

  it('trims whitespace inside brackets', () => {
    expect(renderWikilinks('[[  Goblin Camp  ]]', titleToId))
      .toBe('<a href="#" data-handout-id="hand-1" class="wikilink">Goblin Camp</a>');
  });

  describe('[[roll:<id>]] syntax', () => {
    const tablesById = new Map([['tbl-rumors', { name: 'Local Rumors' }]]);

    it('renders a roll button when the table id is known', () => {
      const out = renderWikilinks('Try [[roll:tbl-rumors]] now.', titleToId, tablesById);
      expect(out).toBe('Try <a href="#" data-roll-table="tbl-rumors" class="wikilink wikilink--roll">🎲 Roll Local Rumors</a> now.');
    });

    it('renders a broken span for an unknown table id', () => {
      const out = renderWikilinks('[[roll:tbl-missing]]', titleToId, tablesById);
      expect(out).toBe('<span class="wikilink wikilink--broken">roll:tbl-missing</span>');
    });

    it('escapes HTML in the table name', () => {
      const tables = new Map([['t1', { name: '<script>' }]]);
      const out = renderWikilinks('[[roll:t1]]', titleToId, tables);
      expect(out).toBe('<a href="#" data-roll-table="t1" class="wikilink wikilink--roll">🎲 Roll &lt;script&gt;</a>');
    });
  });

  describe('entity / item / spell namespace prefixes', () => {
    // [[char:<id>]], [[npc:<id>]], [[item:<id>]], [[spell:<id>]] open
    // the matching preview popup. The ids are looked up in maps passed
    // alongside titleToId so we can resolve display names + reject
    // unknowns.
    const refs = {
      characters: new Map([['chr-aria', { name: 'Aria' }]]),
      npcs:       new Map([['npc-orc',  { name: 'Orc Guard' }]]),
      items:      new Map([['itm-sword', { name: 'Shortsword' }]]),
      spells:     new Map([['sp-fb',     { name: 'Fireball' }]]),
    };

    it('[[char:<id>]] renders a preview-link anchor', () => {
      const out = renderWikilinks('See [[char:chr-aria]].', titleToId, null, refs);
      expect(out).toBe('See <a href="#" data-preview-kind="character" data-preview-id="chr-aria" class="wikilink wikilink--preview">Aria</a>.');
    });

    it('[[npc:<id>]] renders a preview-link anchor', () => {
      const out = renderWikilinks('[[npc:npc-orc]]', titleToId, null, refs);
      expect(out).toBe('<a href="#" data-preview-kind="npc" data-preview-id="npc-orc" class="wikilink wikilink--preview">Orc Guard</a>');
    });

    it('[[item:<id>]] and [[spell:<id>]] render their preview anchors', () => {
      expect(renderWikilinks('[[item:itm-sword]]', titleToId, null, refs))
        .toBe('<a href="#" data-preview-kind="item" data-preview-id="itm-sword" class="wikilink wikilink--preview">Shortsword</a>');
      expect(renderWikilinks('[[spell:sp-fb]]', titleToId, null, refs))
        .toBe('<a href="#" data-preview-kind="spell" data-preview-id="sp-fb" class="wikilink wikilink--preview">Fireball</a>');
    });

    it('unknown id falls through to a broken span', () => {
      expect(renderWikilinks('[[char:missing]]', titleToId, null, refs))
        .toBe('<span class="wikilink wikilink--broken">char:missing</span>');
    });

    it('refs argument is optional - without it, namespaced links are broken', () => {
      expect(renderWikilinks('[[char:chr-aria]]', titleToId))
        .toBe('<span class="wikilink wikilink--broken">char:chr-aria</span>');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { renderWikilinks } from '../utils/wikilinks.js';

describe('wikilinks - pages', () => {
  it('resolves a page title via the pages map', () => {
    const html = renderWikilinks('see [[Blackmoor]] now', new Map(), null, {
      pagesByTitle: new Map([['Blackmoor', 'page-1']]),
    });
    expect(html).toContain('data-page-id="page-1"');
    expect(html).toContain('class="wikilink wikilink--page"');
    expect(html).toContain('>Blackmoor<');
  });

  it('falls back to handout titleToId when page title is unknown', () => {
    const html = renderWikilinks('see [[Tavern]]', new Map([['Tavern', 'h-1']]), null, {});
    expect(html).toContain('data-handout-id="h-1"');
  });

  it('renders broken span when nothing matches', () => {
    const html = renderWikilinks('see [[Nowhere]]', new Map(), null, {});
    expect(html).toContain('class="wikilink wikilink--broken"');
  });
});

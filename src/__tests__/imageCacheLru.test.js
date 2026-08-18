/**
 * Regression: _tokenImages was an unbounded Map. Long sessions could
 * accumulate hundreds of HTMLImageElement instances. Cap at 100,
 * evict oldest on overflow. Repeated access of the same URL bumps it
 * to most-recently-used.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getOrLoadImage } from '../map/layers/image-cache.js';

beforeAll(() => {
  if (!globalThis.Image) {
    globalThis.Image = class {
      constructor() { this.src = ''; }
      set src(v) { this._src = v; }
      get src() { return this._src; }
    };
  }
});

function makeMr() {
  return {
    _tokenImages: new Map(),
    state: { widgetManager: { _client: { homeserver: 'https://hs' } } },
    render: vi.fn(),
  };
}

describe('image cache LRU', () => {
  let mr;
  beforeEach(() => { mr = makeMr(); });

  it('caps at 100 entries; oldest is evicted on overflow', () => {
    for (let i = 0; i < 100; i++) getOrLoadImage(mr, `https://hs/img/${i}.png`);
    expect(mr._tokenImages.size).toBe(100);
    getOrLoadImage(mr, 'https://hs/img/100.png');
    expect(mr._tokenImages.size).toBe(100);
    expect(mr._tokenImages.has('https://hs/img/0.png')).toBe(false);
    expect(mr._tokenImages.has('https://hs/img/100.png')).toBe(true);
  });

  it('repeated access bumps a URL to most-recently-used', () => {
    for (let i = 0; i < 100; i++) getOrLoadImage(mr, `https://hs/img/${i}.png`);
    getOrLoadImage(mr, 'https://hs/img/0.png'); // re-access oldest
    getOrLoadImage(mr, 'https://hs/img/100.png'); // overflow
    expect(mr._tokenImages.has('https://hs/img/0.png')).toBe(true);
    expect(mr._tokenImages.has('https://hs/img/1.png')).toBe(false);
  });
});

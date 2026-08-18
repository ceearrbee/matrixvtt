import { describe, it, expect, beforeEach } from 'vitest';
import {
  openDoc, closeDoc, closeAllDocs, bringDocToFront,
} from '../ui/FloatingDoc.jsx';
import { openDocsSignal } from '../state/ui-signals.js';

describe('FloatingDoc helpers', () => {
  beforeEach(() => { closeAllDocs(); });

  it('openDoc appends a descriptor and assigns a z-index', () => {
    openDoc('handout', 'ho-1');
    expect(openDocsSignal.value).toHaveLength(1);
    const [d] = openDocsSignal.value;
    expect(d.key).toBe('handout:ho-1');
    expect(d.kind).toBe('handout');
    expect(d.id).toBe('ho-1');
    expect(typeof d.z).toBe('number');
  });

  it('opening the same key twice deduplicates and bumps z', () => {
    openDoc('page', 'pg-1');
    const firstZ = openDocsSignal.value[0].z;
    openDoc('handout', 'ho-1');
    openDoc('page', 'pg-1'); // re-open
    expect(openDocsSignal.value).toHaveLength(2);
    const pageEntry = openDocsSignal.value.find((d) => d.key === 'page:pg-1');
    expect(pageEntry.z).toBeGreaterThan(firstZ);
  });

  it('bringDocToFront raises the z above all others', () => {
    openDoc('page', 'a');
    openDoc('page', 'b');
    openDoc('page', 'c');
    bringDocToFront('page:a');
    const sorted = [...openDocsSignal.value].sort((a, b) => a.z - b.z);
    expect(sorted[sorted.length - 1].key).toBe('page:a');
  });

  it('closeDoc removes one entry; closeAllDocs empties the array', () => {
    openDoc('handout', 'ho-1');
    openDoc('page', 'pg-1');
    closeDoc('handout:ho-1');
    expect(openDocsSignal.value.map((d) => d.key)).toEqual(['page:pg-1']);
    closeAllDocs();
    expect(openDocsSignal.value).toEqual([]);
  });
});

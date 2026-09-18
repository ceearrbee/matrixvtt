import { describe, it, expect, beforeEach } from 'vitest';
import {
  openDoc, closeDoc, closeAllDocs, bringDocToFront,
} from '../ui/FloatingDoc.jsx';
import { openDocsSignal } from '../state/ui-signals.js';

describe('FloatingDoc helpers', () => {
  beforeEach(() => { closeAllDocs(); });

  it('openDoc appends a descriptor', () => {
    openDoc('handout', 'ho-1');
    expect(openDocsSignal.value).toHaveLength(1);
    const [d] = openDocsSignal.value;
    expect(d.key).toBe('handout:ho-1');
    expect(d.kind).toBe('handout');
    expect(d.id).toBe('ho-1');
  });

  it('opening the same key twice deduplicates and moves it to the top', () => {
    openDoc('page', 'pg-1');
    openDoc('handout', 'ho-1');
    openDoc('page', 'pg-1'); // re-open
    expect(openDocsSignal.value.map((d) => d.key))
      .toEqual(['handout:ho-1', 'page:pg-1']);
  });

  it('bringDocToFront moves the doc to the end, which is the top of the stack', () => {
    openDoc('page', 'a');
    openDoc('page', 'b');
    openDoc('page', 'c');
    bringDocToFront('page:a');
    expect(openDocsSignal.value.map((d) => d.key))
      .toEqual(['page:b', 'page:c', 'page:a']);
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

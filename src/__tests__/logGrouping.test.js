/**
 * buildLogItems is the log-panel filter + thread-group + author-group
 * pipeline, extracted out of LogPanel.jsx so it can be tested without a
 * DOM and memoized in the component. These tests pin the behaviour the
 * inline version had.
 */

import { describe, it, expect } from 'vitest';
import { buildLogItems, entryMatchesFilter } from '../ui/log-grouping.js';

function chat(id, sender, text, ts = '10:00') {
  return { icon: '💬', eventId: id, sender, text, html: text, ts };
}

describe('entryMatchesFilter', () => {
  it('matches by icon per filter name', () => {
    expect(entryMatchesFilter({ icon: '💬' }, 'chat')).toBe(true);
    expect(entryMatchesFilter({ icon: '🎲' }, 'chat')).toBe(false);
    expect(entryMatchesFilter({ icon: '🎲' }, 'dice')).toBe(true);
    expect(entryMatchesFilter({ icon: '💔' }, 'combat')).toBe(true);
    expect(entryMatchesFilter({ icon: '⚔️' }, 'combat')).toBe(true);
    expect(entryMatchesFilter({ icon: '🗺️' }, 'map')).toBe(true);
  });

  it('passes everything through for the all filter', () => {
    expect(entryMatchesFilter({ icon: '🎲' }, 'all')).toBe(true);
    expect(entryMatchesFilter({ icon: '💬' }, 'all')).toBe(true);
  });
});

describe('buildLogItems', () => {
  it('filters by case-insensitive search over entry text', () => {
    const log = [chat('a', '@a:s', 'Hello there'), chat('b', '@b:s', 'goblin ambush')];
    const { items } = buildLogItems(log, 'all', 'GOBLIN');
    const texts = items.flatMap((i) => (i.entries ?? [i.entry]).map((e) => e.text));
    expect(texts).toEqual(['goblin ambush']);
  });

  it('groups consecutive entries from one sender inside the time window', () => {
    const log = [
      chat('a', '@a:s', 'one', '10:00'),
      chat('b', '@a:s', 'two', '10:02'),
      chat('c', '@b:s', 'three', '10:03'),
    ];
    const { items } = buildLogItems(log, 'all', '');
    expect(items).toHaveLength(2);
    expect(items[0].entries.map((e) => e.text)).toEqual(['one', 'two']);
    expect(items[1].entries.map((e) => e.text)).toEqual(['three']);
  });

  it('splits a group when the sender exceeds the grouping window', () => {
    const log = [
      chat('a', '@a:s', 'one', '10:00'),
      chat('b', '@a:s', 'two', '11:30'),
    ];
    const { items } = buildLogItems(log, 'all', '');
    expect(items).toHaveLength(2);
  });

  it('routes replies into threads keyed by their root event id', () => {
    const log = [
      chat('root', '@a:s', 'root msg'),
      { ...chat('r1', '@b:s', 'a reply'), threadOf: 'root' },
    ];
    const { items, threads } = buildLogItems(log, 'all', '');
    expect(Object.keys(threads)).toEqual(['root']);
    expect(threads.root.map((e) => e.text)).toEqual(['a reply']);
    expect(items).toHaveLength(1);
  });

  it('flattens orphan replies whose root is not in the filtered set', () => {
    const log = [{ ...chat('r1', '@b:s', 'orphan reply'), threadOf: 'missing' }];
    const { items, threads } = buildLogItems(log, 'all', '');
    expect(threads).toEqual({});
    expect(items).toHaveLength(1);
  });

  it('never groups synthetic entries with chat', () => {
    const log = [
      chat('a', '@a:s', 'one'),
      { icon: '🎲', eventId: 'd', sender: '@a:s', text: 'rolled 17', html: 'r', ts: '10:00' },
      chat('b', '@a:s', 'two'),
    ];
    const { items } = buildLogItems(log, 'all', '');
    expect(items.map((i) => i.kind)).toEqual(['group', 'synth', 'group']);
  });

  it('tolerates a missing log', () => {
    expect(buildLogItems(undefined, 'all', '')).toEqual({ items: [], threads: {} });
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildEntryContent,
  parseEntryEvent,
  entryTooLarge,
} from '../library/entry-schema.js';
import { EVENT_TYPES, LIBRARY_KIND, LIBRARY_ENTRY_MAX_BYTES } from '../utils/constants.js';

describe('library constants', () => {
  it('registers library event types', () => {
    expect(EVENT_TYPES.LIBRARY_MARKER).toBe('com.vtt.library');
    expect(EVENT_TYPES.LIBRARY_ENTRY).toBe('com.vtt.library_entry');
  });

  it('enumerates the supported kinds', () => {
    expect(Object.values(LIBRARY_KIND).sort()).toEqual(
      ['character', 'item', 'map', 'npc', 'ruleset', 'spell']
    );
  });

  it('caps entries below the Matrix event size limit', () => {
    expect(LIBRARY_ENTRY_MAX_BYTES).toBeLessThan(65536);
  });
});

describe('buildEntryContent', () => {
  it('stamps version, kind, name, timestamp and data', () => {
    const content = buildEntryContent({
      kind: LIBRARY_KIND.NPC,
      name: 'Goblin',
      data: { hp: 7 },
      now: 1234,
    });
    expect(content).toEqual({
      vtt_version: 1,
      kind: 'npc',
      name: 'Goblin',
      updated_at: 1234,
      data: { hp: 7 },
    });
  });

  it('rejects an unknown kind', () => {
    expect(() => buildEntryContent({ kind: 'weapon', name: 'Axe', data: {} })).toThrow();
  });

  it('rejects a missing name', () => {
    expect(() => buildEntryContent({ kind: 'item', name: '', data: {} })).toThrow();
  });
});

describe('parseEntryEvent', () => {
  const event = (content, stateKey = 'lib-npc-1') => ({
    type: EVENT_TYPES.LIBRARY_ENTRY,
    state_key: stateKey,
    content,
  });

  it('returns the entry with its id from the state_key', () => {
    const content = buildEntryContent({ kind: 'npc', name: 'Goblin', data: { hp: 7 }, now: 5 });
    expect(parseEntryEvent(event(content))).toEqual({
      id: 'lib-npc-1',
      kind: 'npc',
      name: 'Goblin',
      updated_at: 5,
      data: { hp: 7 },
    });
  });

  it('returns null for tombstoned (empty) content', () => {
    expect(parseEntryEvent(event({}))).toBeNull();
  });

  it('returns null for missing or malformed content', () => {
    expect(parseEntryEvent(event(undefined))).toBeNull();
    expect(parseEntryEvent(event({ kind: 'npc' }))).toBeNull();
    expect(parseEntryEvent(event({ vtt_version: 1, kind: 'dragon', name: 'X', data: {} }))).toBeNull();
  });

  it('returns null for a future schema version', () => {
    const content = { vtt_version: 2, kind: 'npc', name: 'Goblin', data: {} };
    expect(parseEntryEvent(event(content))).toBeNull();
  });
});

describe('entryTooLarge', () => {
  it('accepts a normal entry', () => {
    const content = buildEntryContent({ kind: 'item', name: 'Rope', data: { weight: 10 }, now: 1 });
    expect(entryTooLarge(content)).toBe(false);
  });

  it('rejects an entry above the byte cap', () => {
    const content = buildEntryContent({
      kind: 'ruleset',
      name: 'Huge',
      data: { blob: 'x'.repeat(LIBRARY_ENTRY_MAX_BYTES) },
      now: 1,
    });
    expect(entryTooLarge(content)).toBe(true);
  });
});

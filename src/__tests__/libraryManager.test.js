import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryManager } from '../library/LibraryManager.js';
import { buildEntryContent } from '../library/entry-schema.js';
import { EVENT_TYPES, LIBRARY_KIND, LIBRARY_ENTRY_MAX_BYTES } from '../utils/constants.js';

function stubClient(entries = []) {
  const state = [
    { type: EVENT_TYPES.LIBRARY_MARKER, state_key: '', content: { vtt_version: 1 } },
    ...entries,
  ];
  return {
    userId: '@me:hs',
    getJoinedRooms: vi.fn(async () => ['room:lib']),
    getStateEventContent: vi.fn(async (roomId, type, key) =>
      type === EVENT_TYPES.LIBRARY_MARKER && key === '' ? { vtt_version: 1 } : null
    ),
    getRoomState: vi.fn(async () => state),
    createRoom: vi.fn(async () => 'room:new'),
    sendVTTEvent: vi.fn(async () => 'evt:1'),
  };
}

function entryEvent(id, { kind, name, data = {} }) {
  return { type: EVENT_TYPES.LIBRARY_ENTRY, state_key: id, content: buildEntryContent({ kind, name, data, now: 1 }) };
}

describe('LibraryManager.listEntries', () => {
  beforeEach(() => localStorage.clear());

  it('returns parsed entries and skips the marker and tombstones', async () => {
    const client = stubClient([
      entryEvent('lib-1', { kind: LIBRARY_KIND.NPC, name: 'Goblin' }),
      { type: EVENT_TYPES.LIBRARY_ENTRY, state_key: 'lib-2', content: {} },
    ]);
    const mgr = new LibraryManager(client);
    const list = await mgr.listEntries();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'lib-1', kind: 'npc', name: 'Goblin' });
  });

  it('filters by kind when requested', async () => {
    const client = stubClient([
      entryEvent('lib-1', { kind: LIBRARY_KIND.NPC, name: 'Goblin' }),
      entryEvent('lib-2', { kind: LIBRARY_KIND.ITEM, name: 'Rope' }),
    ]);
    const mgr = new LibraryManager(client);
    const list = await mgr.listEntries(LIBRARY_KIND.ITEM);
    expect(list.map((e) => e.name)).toEqual(['Rope']);
  });
});

describe('LibraryManager.saveEntry', () => {
  beforeEach(() => localStorage.clear());

  it('allocates an id and writes a library-entry state event', async () => {
    const client = stubClient([entryEvent('lib-1', { kind: LIBRARY_KIND.NPC, name: 'Goblin' })]);
    const mgr = new LibraryManager(client);
    const id = await mgr.saveEntry({ kind: LIBRARY_KIND.ITEM, name: 'Rope', data: { weight: 10 } });
    expect(id).not.toBe('lib-1');
    const [roomId, type, stateKey, content] = client.sendVTTEvent.mock.calls[0];
    expect(roomId).toBe('room:lib');
    expect(type).toBe(EVENT_TYPES.LIBRARY_ENTRY);
    expect(stateKey).toBe(id);
    expect(content).toMatchObject({ kind: 'item', name: 'Rope', data: { weight: 10 } });
  });

  it('creates the library room on first save when none exists', async () => {
    const client = stubClient();
    client.getJoinedRooms = vi.fn(async () => []);
    client.getStateEventContent = vi.fn(async () => null);
    client.getRoomState = vi.fn(async () => [
      { type: EVENT_TYPES.LIBRARY_MARKER, state_key: '', content: { vtt_version: 1 } },
    ]);
    const mgr = new LibraryManager(client);
    await mgr.saveEntry({ kind: LIBRARY_KIND.ITEM, name: 'Rope', data: {} });
    expect(client.createRoom).toHaveBeenCalled();
    expect(client.sendVTTEvent.mock.calls[0][0]).toBe('room:new');
  });

  it('rejects an entry that exceeds the size cap', async () => {
    const client = stubClient();
    const mgr = new LibraryManager(client);
    await expect(
      mgr.saveEntry({ kind: LIBRARY_KIND.RULESET, name: 'Huge', data: { blob: 'x'.repeat(LIBRARY_ENTRY_MAX_BYTES) } })
    ).rejects.toThrow();
    expect(client.sendVTTEvent).not.toHaveBeenCalled();
  });
});

describe('LibraryManager.deleteEntry / renameEntry', () => {
  beforeEach(() => localStorage.clear());

  it('deletes by writing empty content', async () => {
    const client = stubClient([entryEvent('lib-1', { kind: LIBRARY_KIND.NPC, name: 'Goblin' })]);
    const mgr = new LibraryManager(client);
    await mgr.deleteEntry('lib-1');
    const [, type, stateKey, content] = client.sendVTTEvent.mock.calls[0];
    expect(type).toBe(EVENT_TYPES.LIBRARY_ENTRY);
    expect(stateKey).toBe('lib-1');
    expect(content).toEqual({});
  });

  it('renames while preserving the existing data', async () => {
    const client = stubClient([entryEvent('lib-1', { kind: LIBRARY_KIND.NPC, name: 'Goblin', data: { hp: 7 } })]);
    const mgr = new LibraryManager(client);
    await mgr.renameEntry('lib-1', 'Hobgoblin');
    const [, , stateKey, content] = client.sendVTTEvent.mock.calls[0];
    expect(stateKey).toBe('lib-1');
    expect(content).toMatchObject({ name: 'Hobgoblin', kind: 'npc', data: { hp: 7 } });
  });
});

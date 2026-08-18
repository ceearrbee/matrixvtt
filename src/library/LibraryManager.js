/**
 * CRUD over a user's personal library room. Wraps the raw MatrixClient so
 * the UI never touches cross-room transport directly. All writes go through
 * `sendVTTEvent`, inheriting its rate-limit retry; the room is created
 * lazily on the first write.
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { ensureLibraryRoom, findLibraryRoom } from './discovery.js';
import { buildEntryContent, parseEntryEvent, entryTooLarge } from './entry-schema.js';
import { allocateEntityId } from '../utils/stable-id.js';
import { ErrorType, VTTError } from '../utils/errorHandling.js';

export class LibraryManager {
  constructor(matrixClient) {
    this._client = matrixClient;
  }

  async _readEntries(roomId) {
    const state = await this._client.getRoomState(roomId);
    return (state || [])
      .filter((e) => e.type === EVENT_TYPES.LIBRARY_ENTRY)
      .map(parseEntryEvent)
      .filter(Boolean);
  }

  /** List library entries, optionally filtered to a single kind. */
  async listEntries(kind = null) {
    const roomId = await findLibraryRoom(this._client);
    if (!roomId) return [];
    const entries = await this._readEntries(roomId);
    const filtered = kind ? entries.filter((e) => e.kind === kind) : entries;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Save a new entry (or overwrite `id`) and return its state_key.
   * @param {{kind: string, name: string, data: object, id?: string, now?: number}} entry
   */
  async saveEntry({ kind, name, data, id = null, now = Date.now() }) {
    const content = buildEntryContent({ kind, name, data, now });
    if (entryTooLarge(content)) {
      throw new VTTError(
        ErrorType.VALIDATION,
        `This ${kind} is too large to store as a library entry`
      );
    }
    const roomId = await ensureLibraryRoom(this._client);
    let stateKey = id;
    if (!stateKey) {
      const existing = await this._readEntries(roomId);
      const idMap = new Map(existing.map((e) => [e.id, e]));
      stateKey = await allocateEntityId('lib', idMap);
    }
    await this._client.sendVTTEvent(roomId, EVENT_TYPES.LIBRARY_ENTRY, stateKey, content);
    return stateKey;
  }

  /** Delete an entry by writing empty content (Matrix tombstone). */
  async deleteEntry(id) {
    const roomId = await findLibraryRoom(this._client);
    if (!roomId) return;
    await this._client.sendVTTEvent(roomId, EVENT_TYPES.LIBRARY_ENTRY, id, {});
  }

  /** Rename an entry, preserving its kind and data. */
  async renameEntry(id, name) {
    const roomId = await findLibraryRoom(this._client);
    if (!roomId) throw new VTTError(ErrorType.VALIDATION, 'No library room found');
    const existing = (await this._readEntries(roomId)).find((e) => e.id === id);
    if (!existing) throw new VTTError(ErrorType.VALIDATION, 'Library entry not found');
    await this.saveEntry({ kind: existing.kind, name, data: existing.data, id });
  }
}

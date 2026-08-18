/**
 * Marshalling for library entries stored as `com.vtt.library_entry` state
 * events. Entries cross a trust boundary (read from a Matrix room that may
 * hold data written by an older or hostile client), so reads validate with
 * Valibot and reject rather than throw on the receive path.
 */

import { LIBRARY_ENTRY_MAX_BYTES, LIBRARY_KIND } from '../utils/constants.js';
import { v } from '../utils/schemas/helpers.js';
import { ErrorType, VTTError } from '../utils/errorHandling.js';

const ENTRY_VERSION = 1;

const kindSchema = v.picklist(Object.values(LIBRARY_KIND));

const entryContentSchema = v.object({
  vtt_version: v.literal(ENTRY_VERSION),
  kind: kindSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  updated_at: v.optional(v.number()),
  data: v.record(v.string(), v.unknown()),
});

/**
 * Build the state-event content for a new or updated library entry.
 * Throws VTTError on invalid kind or empty name (a local programmer error,
 * surfaced before the write leaves the client).
 */
export function buildEntryContent({ kind, name, data, now = 0 }) {
  if (!Object.values(LIBRARY_KIND).includes(kind)) {
    throw new VTTError(ErrorType.VALIDATION, `Unknown library kind: ${kind}`);
  }
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    throw new VTTError(ErrorType.VALIDATION, 'A library entry needs a name');
  }
  return {
    vtt_version: ENTRY_VERSION,
    kind,
    name: trimmed,
    updated_at: now,
    data: data && typeof data === 'object' ? data : {},
  };
}

/**
 * Parse an incoming library-entry state event into a plain entry object,
 * or null if the content is tombstoned, malformed, or a newer version.
 */
export function parseEntryEvent(event) {
  const content = event?.content;
  if (!content || typeof content !== 'object' || Object.keys(content).length === 0) {
    return null;
  }
  const result = v.safeParse(entryContentSchema, content);
  if (!result.success) return null;
  const parsed = result.output;
  return {
    id: event.state_key,
    kind: parsed.kind,
    name: parsed.name,
    updated_at: parsed.updated_at ?? 0,
    data: parsed.data,
  };
}

/** True when serialised content would exceed the Matrix state-event cap. */
export function entryTooLarge(content) {
  return JSON.stringify(content).length > LIBRARY_ENTRY_MAX_BYTES;
}

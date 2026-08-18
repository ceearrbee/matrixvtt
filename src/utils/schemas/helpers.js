/**
 * Schema validation helpers shared across schema modules.
 */

import * as v from 'valibot';
import { ErrorType, VTTError } from '../errorHandling.js';

export { v };

export const matrixUserId = v.pipe(v.string(), v.regex(/^@[^:]+:.+$/));
export const cellCoord = v.pipe(v.string(), v.regex(/^\d+,\d+$/));
export const hexColor = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{3,6}$/));

export function failIfNotObject(content, kind) {
  if (!content || typeof content !== 'object') {
    throw new VTTError(ErrorType.VALIDATION, `${kind} content must be an object`);
  }
}

export function failValidation(message) {
  throw new VTTError(ErrorType.VALIDATION, message);
}

export function parseOrThrow(schema, content, messageFor) {
  const result = v.safeParse(schema, content);
  if (!result.success) {
    const issue = result.issues[0];
    throw new VTTError(ErrorType.VALIDATION, messageFor(issue) || issue.message);
  }
  return true;
}

export function pathOf(issue) {
  return (issue.path || []).map((p) => p.key).join('.');
}

/**
 * Optional portrait/icon URL accepted on tokens, characters, NPCs,
 * items, spells, and handouts. Source can be a built-in icon URL
 * (.../icons/{theme}/<author>/<name>.svg), mxc://, or external https.
 * Cap at 1024 chars so a malformed copy-paste can't bloat a state event.
 */
export function validateImageUrlField(content, kind) {
  const url = content.image_url;
  if (url === undefined || url === null) return;
  if (typeof url !== 'string') failValidation(`${kind} image_url must be a string`);
  if (url.length > 1024) failValidation(`${kind} image_url too long`);
}

/**
 * Per-user dice macros. Stored in the browser rather than the room:
 * a macro is a personal shortcut, not campaign state, and the room is
 * already the database for everything the table shares.
 */
import { readUserScoped, writeUserScoped } from '../utils/user-storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { diceMacrosSignal } from '../state/ui-signals.js';

const KEY = STORAGE_KEYS.DICE_MACROS;

export function readDiceMacros(userId) {
  const raw = readUserScoped(KEY, userId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((f) => typeof f === 'string' && f) : [];
  } catch {
    return [];
  }
}

export function saveDiceMacro(userId, formula) {
  const trimmed = String(formula ?? '').trim();
  if (!trimmed || !userId) return readDiceMacros(userId);
  const macros = readDiceMacros(userId);
  if (macros.includes(trimmed)) return macros;
  const next = [...macros, trimmed];
  writeUserScoped(KEY, userId, JSON.stringify(next));
  diceMacrosSignal.value = next;
  return next;
}

export function deleteDiceMacro(userId, formula) {
  const next = readDiceMacros(userId).filter((f) => f !== formula);
  writeUserScoped(KEY, userId, JSON.stringify(next));
  diceMacrosSignal.value = next;
  return next;
}

/** Prime the signal from storage once a user id is known. */
export function loadDiceMacros(userId) {
  const macros = readDiceMacros(userId);
  diceMacrosSignal.value = macros;
  return macros;
}

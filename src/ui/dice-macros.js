import { STORAGE_KEYS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { readUserScoped, writeUserScoped } from '../utils/user-storage.js';

const KEY = STORAGE_KEYS.DICE_MACROS;

/** @returns {{ name: string, formula: string }[]} */
export function getDiceMacros(userId) {
  try {
    return JSON.parse(readUserScoped(KEY, userId) ?? '[]');
  } catch {
    return [];
  }
}

export function saveDiceMacro(userId, name, formula) {
  const macros = getDiceMacros(userId);
  const idx = macros.findIndex((m) => m.name === name);
  if (idx >= 0) {
    macros[idx].formula = formula;
  } else {
    macros.push({ name, formula });
  }
  try {
    writeUserScoped(KEY, userId, JSON.stringify(macros));
  } catch (error) {
    logger.warn('UI', 'Failed to save dice macro:', error.message);
  }
}

export function deleteDiceMacro(userId, name) {
  const macros = getDiceMacros(userId).filter((m) => m.name !== name);
  try {
    writeUserScoped(KEY, userId, JSON.stringify(macros));
  } catch (error) {
    logger.warn('UI', 'Failed to save dice macro:', error.message);
  }
}

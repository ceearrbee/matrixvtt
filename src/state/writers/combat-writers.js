/**
 * combat-writers.js - initiative, damage audit log, and AoE templates.
 * All combat-shaped state writes live here.
 */

import { isGM } from '../reader.js';
import { VTTError, ErrorType } from '../../utils/errorHandling.js';

function requireGM(sm, action) {
  if (!isGM(sm)) throw new VTTError(ErrorType.PERMISSION, `Only the GM can ${action}.`);
}

export async function updateInitiative(sm, init) {
  requireGM(sm, 'edit initiative');
  sm.yjs.initiativeMap.set('', init);
}

export async function clearInitiative(sm) {
  requireGM(sm, 'clear initiative');
  const empty = { active: false, round: 0, current_index: 0, order: [] };
  sm.yjs.initiativeMap.set('', empty);
}

const DAMAGE_LOG_CAP = 100;

export function recordDamage(sm, entry) {
  if (!entry || typeof entry !== 'object') return;
  const record = {
    ts: entry.ts ?? Date.now(),
    actor: entry.actor ?? null,
    target_id: entry.target_id ?? null,
    target_name: entry.target_name ?? null,
    delta: typeof entry.delta === 'number' ? entry.delta : 0,
    kind: entry.kind ?? 'damage',
    source: entry.source ?? null,
  };
  sm.damageLog.push(record);
  if (sm.damageLog.length > DAMAGE_LOG_CAP) {
    sm.damageLog.splice(0, sm.damageLog.length - DAMAGE_LOG_CAP);
  }
}

export async function addTemplate(sm, template) {
  requireGM(sm, 'add a template');
  if (!template?.id) throw new Error('Template must have id');
  sm.yjs.templatesMap.set(template.id, template);
}

export async function updateTemplate(sm, id, patch) {
  requireGM(sm, 'edit a template');
  const existing = sm.templates.get(id);
  if (!existing) return;
  sm.yjs.templatesMap.set(id, { ...existing, ...patch, id });
}

export async function removeTemplate(sm, id) {
  requireGM(sm, 'remove a template');
  if (!sm.templates.has(id)) return;
  sm.yjs.templatesMap.delete(id);
}

export async function clearTemplates(sm) {
  requireGM(sm, 'clear templates');
  const ids = [...sm.templates.keys()];
  sm.yjs.templatesMap.doc.transact(() => {
    for (const id of ids) sm.yjs.templatesMap.delete(id);
  });
}

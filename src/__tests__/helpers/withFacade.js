/**
 * Augment a test-state stub with the facade writer methods. Tests that
 * construct their own `state` object (rather than a real StateManager)
 * can call `withFacade(state)` so UI code under test finds the
 * `updateCharacter`, `updateNPC`, `updateToken`, `updateSettings`, etc.
 * methods it now expects.
 *
 * Each method mirrors the real writer: mutates the local collection /
 * singleton, then calls the stub's `sendStateEvent`.
 */

export function withFacade(state) {
  const s = state.sendStateEvent;
  state.characters = state.characters ?? new Map();
  state.npcs       = state.npcs ?? new Map();
  state.items      = state.items ?? new Map();
  state.spells     = state.spells ?? new Map();
  state.tokens     = state.tokens ?? new Map();
  state.handouts   = state.handouts ?? new Map();
  state.tables     = state.tables ?? new Map();

  state.updateCharacter = async (id, c) => { state.characters.set(id, c); return s('com.vtt.character', id, c); };
  state.removeCharacter = async (id)     => { state.characters.delete(id); return s('com.vtt.character', id, {}); };
  state.updateNPC       = async (id, n)  => { state.npcs.set(id, n);       return s('com.vtt.npc', id, n); };
  state.removeNPC       = async (id)     => { state.npcs.delete(id);       return s('com.vtt.npc', id, {}); };
  state.updateItem      = async (id, i)  => { state.items.set(id, i);      return s('com.vtt.item', id, i); };
  state.removeItem      = async (id)     => { state.items.delete(id);      return s('com.vtt.item', id, {}); };
  state.updateSpell     = async (id, sp) => { state.spells.set(id, sp);    return s('com.vtt.spell', id, sp); };
  state.removeSpell     = async (id)     => { state.spells.delete(id);     return s('com.vtt.spell', id, {}); };
  state.updateToken     = async (id, t)  => { state.tokens.set(id, t);     return s('com.vtt.token', id, t); };
  state.updateHandout   = async (id, h)  => { state.handouts.set(id, h);   return s('com.vtt.handout', id, h); };
  state.removeHandout   = async (id)     => { state.handouts.delete(id);   return s('com.vtt.handout', id, {}); };
  state.updateTable     = async (id, t)  => { state.tables.set(id, t);     return s('com.vtt.table', id, t); };
  state.removeTable     = async (id)     => { state.tables.delete(id);     return s('com.vtt.table', id, {}); };

  state.updateSettings = async (next) => { state.settings = next; return s('com.vtt.settings', '', next); };

  state.updateInitiative = async (i) => { state.initiative = i; return s('com.vtt.initiative', '', i); };
  state.clearInitiative = async () => {
    state.initiative = { active: false, round: 0, current_index: 0, order: [] };
    return s('com.vtt.initiative', '', state.initiative);
  };

  state.updateFog = async (fog) => {
    const current = state.fog?.version ?? 0;
    const { base_version: _omit, ...rest } = fog ?? {};
    const next = { ...rest, version: current + 1 };
    state.fog = next;
    return s('com.vtt.fog', '', next);
  };

  return state;
}

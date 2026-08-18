/**
 * When damage is applied to a token whose linked character is
 * concentrating on a spell (level ≥ 1, prepared, concentration: true),
 * combat.js emits an m.notice chat message with the ruleset-derived
 * concentration DC and the spell name. Skipped when no character is
 * linked, when the character isn't concentrating, or when the active
 * ruleset doesn't declare a concentration_dc formula.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyDamage, applyDamageToTokens } from '../map/actions/combat.js';

const FIVE_E_CONCENTRATION_DC = {
  formulas: {
    concentration_dc: {
      $: 'max',
      args: [10, { $: 'floor', args: [{ $: '/', args: ['@damage', 2] }] }],
    },
  },
};

function makeMr({ systemConfig = FIVE_E_CONCENTRATION_DC, tokens = new Map(), characters = new Map(), spells = new Map() } = {}) {
  const sendRoomEvent = vi.fn().mockResolvedValue(undefined);
  const updateToken = vi.fn().mockResolvedValue(undefined);
  return {
    sendRoomEvent,
    state: {
      tokens,
      characters,
      spells,
      settings: { systemConfig },
      widgetManager: { sendRoomEvent, userId: '@gm:s' },
      sendRoomEvent,
      updateToken,
    },
  };
}

function setupConcentrating({ damageDamageHelper, damage = 5, hpMax = 30 } = {}) {
  const tokens = new Map();
  const characters = new Map();
  const spells = new Map();
  spells.set('spl1', { name: 'Bless', level: 1, concentration: true, prepared: true });
  characters.set('chr1', { id: 'chr1', name: 'Aria', spell_ids: ['spl1'] });
  tokens.set('tok1', { id: 'tok1', name: "Aria's Token", sheet_id: 'chr1', hp_current: hpMax, hp_max: hpMax });
  return makeMr({ tokens, characters, spells });
}

describe('concentration trigger on damage', () => {
  beforeEach(() => {
    // Ensure window for VTT_EVENTS.DAMAGE dispatch
    if (!globalThis.window) globalThis.window = globalThis;
  });

  it('damages a concentrating PC and emits an m.notice with DC 10 (damage 5)', async () => {
    const mr = setupConcentrating();
    await applyDamage(mr, 'tok1', 5);
    const calls = mr.state.widgetManager.sendRoomEvent.mock.calls;
    const chatCall = calls.find(([type]) => type === 'm.room.message');
    expect(chatCall).toBeTruthy();
    expect(chatCall[1]).toMatchObject({ msgtype: 'm.notice' });
    expect(chatCall[1].body).toContain('Aria');
    expect(chatCall[1].body).toContain('Bless');
    expect(chatCall[1].body).toContain('DC 10');
  });

  it('damages 24 → DC 12 (max(10, floor(24/2)))', async () => {
    const mr = setupConcentrating({ hpMax: 100 });
    await applyDamage(mr, 'tok1', 24);
    const chatCall = mr.state.widgetManager.sendRoomEvent.mock.calls
      .find(([type]) => type === 'm.room.message');
    expect(chatCall[1].body).toContain('DC 12');
  });

  it('does not announce for a non-concentrating PC', async () => {
    const mr = setupConcentrating();
    // Mark spell as not prepared
    mr.state.spells.get('spl1').prepared = false;
    await applyDamage(mr, 'tok1', 5);
    const chatCall = mr.state.widgetManager.sendRoomEvent.mock.calls
      .find(([type]) => type === 'm.room.message');
    expect(chatCall).toBeUndefined();
  });

  it('does not announce when token has no linked character', async () => {
    const tokens = new Map();
    tokens.set('tok-npc', { id: 'tok-npc', name: 'Goblin', hp_current: 10, hp_max: 10 });
    const mr = makeMr({ tokens });
    await applyDamage(mr, 'tok-npc', 3);
    const chatCall = mr.state.widgetManager.sendRoomEvent.mock.calls
      .find(([type]) => type === 'm.room.message');
    expect(chatCall).toBeUndefined();
  });

  it('does not announce when ruleset has no concentration_dc formula', async () => {
    const mr = setupConcentrating();
    mr.state.settings.systemConfig = { formulas: {} };
    await applyDamage(mr, 'tok1', 5);
    const chatCall = mr.state.widgetManager.sendRoomEvent.mock.calls
      .find(([type]) => type === 'm.room.message');
    expect(chatCall).toBeUndefined();
  });

  it('applyDamageToTokens bulk path also triggers the prompt', async () => {
    const mr = setupConcentrating();
    await applyDamageToTokens(mr, ['tok1'], 7);
    const chatCall = mr.state.widgetManager.sendRoomEvent.mock.calls
      .find(([type]) => type === 'm.room.message');
    expect(chatCall).toBeTruthy();
    expect(chatCall[1].body).toContain('Bless');
  });

  it('writer failure does not block the concentration prompt from being skipped', async () => {
    // If updateToken rejects, applyDamage early-returns; no concentration message either.
    const mr = setupConcentrating();
    mr.state.updateToken = vi.fn().mockRejectedValue(new Error('rate limit'));
    await applyDamage(mr, 'tok1', 5).catch(() => {});
    const chatCall = mr.state.widgetManager.sendRoomEvent.mock.calls
      .find(([type]) => type === 'm.room.message');
    expect(chatCall).toBeUndefined();
  });
});

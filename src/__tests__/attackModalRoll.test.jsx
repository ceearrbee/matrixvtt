/**
 * Attack modal wiring. `resolveAttack` is covered in isolation by
 * attackResolution.test.js; this covers the modal that calls it, which
 * is where the "Roll Attack does nothing" report actually lived.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import { openAttackResolveModal } from '../ui/AttackModal.jsx';
import { closeAllOpenModals } from '../ui/modal-host.js';
import { tokensSignal } from '../state/signals.js';

const ATTACKER = 'tok-attacker';
const TARGET = 'tok-target';

function makeUi() {
  const tokens = new Map([
    [ATTACKER, { id: ATTACKER, name: 'Aria', ac: 15 }],
    [TARGET, { id: TARGET, name: 'Kael', ac: 10 }],
  ]);
  tokensSignal.value = tokens;
  return {
    state: {
      tokens,
      settings: { systemConfig: {} },
      isGM: () => true,
    },
    diceRoller: {
      roll: vi.fn()
        .mockReturnValueOnce({ rolls: [18], result: 23, modifier: 5 })
        .mockReturnValueOnce({ rolls: [4], result: 7, modifier: 3 }),
    },
    mapRenderer: { applyDamage: vi.fn().mockResolvedValue({}) },
    toggleCombatAction: vi.fn().mockResolvedValue({}),
    chat: { _send: vi.fn().mockResolvedValue({}) },
    _toast: vi.fn(),
    _log: vi.fn(),
  };
}

function flush() { return new Promise((r) => setTimeout(r, 20)); }

describe('AttackModal resolve mode', () => {
  beforeEach(() => { tokensSignal.value = new Map(); });
  afterEach(() => { closeAllOpenModals(); tokensSignal.value = new Map(); });

  it('renders a result in the result area when Roll Attack is clicked', async () => {
    const ui = makeUi();
    await openAttackResolveModal(ui, ATTACKER, {
      name: 'Shortsword', attack_bonus: 5, damage: '1d6+3', damage_type: 'piercing',
    }, TARGET);

    const area = document.querySelector('#attack-result-area');
    expect(area).toBeTruthy();
    expect(area.innerHTML).toBe('');

    const roll = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Roll Attack'));
    expect(roll).toBeTruthy();

    fireEvent.click(roll);
    await flush();

    expect(document.querySelector('#attack-result-area').textContent).toMatch(/hit|miss/i);
  });

  it('offers an Apply damage button on a hit', async () => {
    const ui = makeUi();
    await openAttackResolveModal(ui, ATTACKER, {
      name: 'Shortsword', attack_bonus: 5, damage: '1d6+3', damage_type: 'piercing',
    }, TARGET);

    fireEvent.click([...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Roll Attack')));
    await flush();

    const apply = document.querySelector('#apply-damage-btn');
    expect(apply).toBeTruthy();
    expect(apply.dataset.damage).toBe('7');

    fireEvent.click(apply);
    await flush();
    expect(ui.mapRenderer.applyDamage).toHaveBeenCalledWith(TARGET, 7);
  });
});
